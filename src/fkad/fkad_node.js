/** 
* FKAD_NODE
* The nucleus of FKAD, implementing a modified
* version of the Kademlia prototocol
* 
*
*
*/ 

"use strict";


const { Fapp_cfg } = require("../fapp/fapp_cfg.js");
const cfg = require("../../libfood.json");  
const { Fbigint } = Fapp_cfg.ENV[cfg.ENV] === Fapp_cfg.ENV.REACT_NATIVE ? 
  require("../ftypes/fbigint/fbigint_rn.js") : require("../ftypes/fbigint/fbigint_node.js");
const { Fapp_bboard } = require("../fapp/fapp_bboard.js");
const { Flog } = require("../flog/flog.js");
const { Fcrypto } = require("../fcrypto/fcrypto.js");
const { Fkad_net } = require("./net/fkad_net.js");
const { Fkad_eng } = require("./eng/fkad_eng.js");
const { Fkad_node_info } = require("./fkad_node_info.js");
const { Fkad_kbucket } = require("./fkad_kbucket.js");
const { Fkad_kbucket_rec } = require("./fkad_kbucket_rec.js"); 
const { Fkad_msg } = require("./fkad_msg.js");
const { Fkad_ds } = require("./fkad_ds.js");
const { Fkad_data } = require("./fkad_data.js");
const { Fbintree } = require("../ftypes/fbintree/fbintree.js");
const { Fbintree_node } = require("../ftypes/fbintree/fbintree_node.js");
const { Fid } = require("../fid/fid.js");
const { Fgeo_coord } = require("../fgeo/fgeo_coord.js");
const { Fpht_node } = require("../fpht/fpht_node.js");
const { Fpht_key } = require("../fpht/fpht_key.js");

class Fkad_node {
  /**
   * T_KBUCKET_REFRESH: How frequently to force a refresh on stale k-buckets? (default is 1 hour, 
   * but very frequent refreshes help with churn in small networks)
   * T_DATA_TTL: How long does data live before expiring?
   * T_REPUBLISH: How often do we republish all of our originally published data?
   * T_REPLICATE: How often do we republish our partition of the keyspace?
   */ 

  static DHT_BIT_WIDTH = 160;
  static ID_LEN = this.DHT_BIT_WIDTH / cfg.SYS_BYTE_WIDTH;
  static K_SIZE = 20;
  static ALPHA = 3;
  static T_KBUCKET_REFRESH = 1000 * 5;
  static T_DATA_TTL = 1000 * 60 * 60 * 25;
  static T_REPUBLISH = 1000 * 60 * 60 * 24;
  static T_REPLICATE = 1000 * 60 * 60;

  net;
  eng;
  node_id;
  node_info;
  routing_table;
  refresh_interval_handle;
  republish_interval_handle;
  replicate_interval_handle;
  data;
  published;

  RPC_RES_EXEC = new Map([
    [Fkad_msg.RPC.PING, this._res_ping],
    [Fkad_msg.RPC.STORE, this._res_store],
    [Fkad_msg.RPC.FIND_NODE, this._res_find_node],
    [Fkad_msg.RPC.FIND_VALUE, this._res_find_value]
  ]);

  /**
   * net: an Fkad_net module
   * eng: an Fkad_eng module
   * 
   * addr and port must be your external network info, resolved with STUN or similar
   */ 
  constructor({net = null, eng = null, addr = null, port = null, pubkey = null} = {}) {
    if (!(net instanceof Fkad_net)) {
      throw new TypeError("Argument 'net' must be instance of Fkad_net");
    }

    if (!(eng instanceof Fkad_eng)) {
      throw new TypeError("Argument 'eng' must be instance of Fkad_eng");
    }

    this.refresh_interval_handle = null;
    this.republish_interval_handle = null;

    this.net = net;
    this.eng = eng;
    this.node_id = new Fbigint(Fcrypto.sha1(pubkey));

    this.node_info = new Fkad_node_info({
      addr: addr, 
      port: port, 
      node_id: new Fbigint(this.node_id), 
      pubkey: pubkey
    });

    this.routing_table = new Fbintree(new Fbintree_node({
      data: new Fkad_kbucket({max_size: Fkad_node.K_SIZE, prefix: ""})
    }));

    this.data = new Fkad_ds();
    this.published = new Map();
    this.eng.node = this;
    this.net.node = this;
  }

  /**
   * Enforce data integrity on the DHT. This is our hook to perform basic security to mitigate
   * storage-based attacks (index poisoning, etc). We run this on all data we receive via a 
   * value lookup, and also on any data that a peer asks us to store.
   */ 
  static async _is_valid_storable(data) {
    try {
      /**
       * Rule: we must only allow the storage of PHT nodes to our DHT. TODO: we obviously need a more
       * robust method for validating a PHT node by schema
       */ 
      if (!Fpht_node.valid_magic(data)) {
        return false;
      }

      const pairs = Fpht_node.get_all_pairs(data);

      for (let i = 0; i < pairs.length; i += 1) {
        const [location_key_str, bboard] = pairs[i];
        const location_key = Fpht_key.from(location_key_str);

        /**
         * Rule: location_key must be a valid Fpht_key; its integral part must be a valid n-bit
         * linearization; the meta part of the Fpht_key must meet requirements (as of 9/19/2021, 
         * that means meta must be the pubkey of the publisher named on the bboard); and bboard 
         * must be a valid Fapp_bboard object. TODO: write me
         */

        /**
         * Rule: The data must be published by a peer with a valid proof of work. TODO: this is insecure  
         * until we replace Fid.hash_cert() with a new system which hashes over the entire Fid_pub
         */ 
        const pow = Fid.is_valid_pow(
          Fid.hash_cert(bboard.cred.pubkey, bboard.cred.nonce), 
          Fid.POW_ZERO_BITS
        );

        if (!pow) {
          return false;
        }

        /**
         * Rule: the data must be published by a peer who's in the strong set. TODO: write me
         */ 

        /**
         * Rule: the data must be signed by the genuine owner of the named keypair
         */ 
        const valid_sig = await Fapp_bboard.verify(bboard, bboard.cred.pubkey);

        if (!valid_sig) {
          return false;
        }

        /**
         * Rule: the integral part of location_key matches the lat/long found in the signed data. 
         * TODO: this is also insecure until we replace Fid.hash_cert() as above
         */ 
        const coord = new Fgeo_coord({lat: bboard.cred.lat, long: bboard.cred.long});
        const valid_lk = Fpht_key.get_integral(location_key).equals(coord.linearize());

        if (!valid_lk) {
          return false;
        }
      }

      return true;
    } catch (err) {
      return false;
    } 
  }
  
  /**
   * Get XOR "distance" between two Fbigint values
   */ 
  static _get_distance(key1, key2) {
    return key1.xor(key2);
  }

  /**
   * Perform a refresh on a given k-bucket. Per the Kademlia spec, we're supposed to select a 
   * "random ID in the bucket's range." Currently we do this by selecting a random node in the bucket. 
   * TODO: it's prob more rigorous to generate a random ID over the interval of the bucket's range...
   */ 
  async _refresh_kbucket(kbucket) {
    const random_id = kbucket.get(Math.floor(Math.random() * kbucket.length())).node_info.node_id;
    const prefix = kbucket.get_prefix();
    Flog.log(`[FKAD] Refreshing k-bucket ${prefix.length === 0 ? "[root]" : prefix} ` + 
      `(${kbucket.length()} contact${kbucket.length() > 1 ? "s" : ""})`);
    await this.node_lookup(random_id);
  }

  /**
   * Find the appropriate leaf node in the routing table for a given node ID (as Fbigint)
   */ 
  find_kbucket_for_id(id) {
    let node = this.routing_table.get_root();
    let i = 0;

    while (node.get_left() !== null && node.get_right() !== null) {
      node = node.get_child_bin(id.get_bit(i));
      i += 1;
    }

    return node;
  }

  /**
   * TODO: this god function is not chad mode
   * We need to separate our concerns and break this up. These are the activities being performed
   * here: deciding if a contact needs to be inserted, handling the easy insertion case, handling
   * the hard insertion case which requires bucket splitting, and replicating data to new contacts.
   */ 
  _routing_table_insert(inbound_node_info) {
    let leaf_node = this.find_kbucket_for_id(inbound_node_info.node_id);
    let bucket = leaf_node.get_data();
    const kbucket_rec = bucket.exists(inbound_node_info);

    /**
     * TODO: a locked contact is silently unlocked before insertion by wrapping it in a fresh 
     * Fkad_kbucket_rec; it's bad for code comprehension bc the locking occurs in Fkad_eng_alpha
     */ 
    const new_kbucket_rec = new Fkad_kbucket_rec({node_info: inbound_node_info});

    if (kbucket_rec !== null) {
      /**
       * CASE 1: We've already seen this node in this bucket, so just move a fresh record to the tail
       */ 
      bucket.delete(kbucket_rec);
      bucket.enqueue(new_kbucket_rec);
    } else if (kbucket_rec === null && !bucket.is_full()) {
      /**
       * CASE 2: We've never seen this node and the appropriate bucket isn't full, so just insert it
       */ 
      bucket.enqueue(new_kbucket_rec);

      /**
       * Replicate any of our data that is appropriate to this new node
       */
      this.data.entries().forEach((pair) => {
        const [key_str, val] = pair;
        const key = new Fbigint(key_str);
        const cnodes = this._get_nodes_closest_to({key: key});

        /**
         * If the new node is one of the K closest nodes to this key AND we are closer to the key 
         * than any of my neighbors (or the new node is now closer to the key than we are), then 
         * replicate this (key, value) pair to the new node
         */ 
        if (cnodes.includes(inbound_node_info) && 
          (Fkad_node._get_distance(this.node_id, key).less_equal(
            Fkad_node._get_distance(cnodes[0].node_id, key) || 
              cnodes[0] === inbound_node_info))) {
          
          Flog.log(`[FKAD] Replicating ${key.toString()} to new node ` +
          `${inbound_node_info.node_id.toString()}`);

          this._req_store(key, val.get_data(), inbound_node_info);
        }
      });
    } else {
      /**
       * CASE 3: We've never seen this node but the appropriate bucket is full
       */ 
      const our_bucket = this.find_kbucket_for_id(this.node_id).get_data();

      if (bucket === our_bucket) {
        /**
         * 3A: The incoming node_info's bucket's range includes our ID, so split the bucket
         */ 
        const left_child = new Fbintree_node({
          parent: leaf_node, 
          data: new Fkad_kbucket({max_size: Fkad_node.K_SIZE, prefix: `${bucket.get_prefix()}0`})
        });

        const right_child = new Fbintree_node({
          parent: leaf_node,
          data: new Fkad_kbucket({max_size: Fkad_node.K_SIZE, prefix: `${bucket.get_prefix()}1`})
        });

        leaf_node.set_left(left_child);
        leaf_node.set_right(right_child);
        leaf_node.set_data(null);

        /**
         * Redistribute the Fkad_kbucket_recs from the old bucket to the new leaves
         */ 
        bucket.to_array().forEach((kbucket_rec) => {
          const b = kbucket_rec.node_info.node_id.get_bit(bucket.get_prefix().length);
          leaf_node.get_child_bin(b).get_data().enqueue(kbucket_rec);
        });

        /**
         * Attempt reinsertion via recursion
         */ 
        this._routing_table_insert(inbound_node_info);
      } else {
        /**
         * 3B: The incoming node_info's bucket's range does not include our ID. Per the spec,
         * section 4.1, the optimized way to handle this is to add the new contact to the 
         * "replacement cache" and do a lazy replacement -- i.e., swap in a peer from the 
         * replacement cache the next time we mark a peer in this bucket range as stale. 
         * 
         * TODO: this case requires an implementation!
         * 
         * TODO: remember that, when lazy replacing a peer, you probably need to perform the 
         * replication check in CASE 2. Why? Well, at the time a peer was placed in the replacement
         * cache, we do know that since their bucket range doesn't include our ID, they are not
         * one of the K closest peers responsible for values in our partition of the keyspace. But
         * the routing table will have changed by the time we get around to lazy replacing them...
         */
      }
    }
  }

  /**
   * BST comparator function for insertion of an Fkad_node_info: sort the BST by both XOR distance 
   * from 'key' and lexicographical distance of the Fkad_node_info's concatenated addr and port. 
   * This keeps the BST sorted by the Kademlia distance metric while also handling data elements 
   * which share the same key but have different network info due to churn...
   */ 
  _insert_by_xor_lex(key, node, oldnode) {
    if (Fkad_node._get_distance(key, node.get_data().node_id).less(
      Fkad_node._get_distance(key, oldnode.get_data().node_id))) {
      return -1;
    } else if (Fkad_node._get_distance(key, node.get_data().node_id).greater(
      Fkad_node._get_distance(key, oldnode.get_data().node_id))) {
      return 1;
    }

    const node_net_info = `${node.get_data().addr}${node.get_data().port}`;
    const oldnode_net_info = `${oldnode.get_data().addr}${oldnode.get_data().port}`;
    return node_net_info.localeCompare(oldnode_net_info);
  }

  /**
   * BST comparator function to search over a tree of Fkad_node_infos: assumes the tree is sorted 
   * using _insert_by_xor_lex(), where the XOR distance is measured from 'key'. Note the subtle
   * difference between this function and _insert_by_xor_lex(): BST insertion comparators work with 
   * BST nodes, while BST search comparators work with BST values.
   */ 
  _search_by_xor_lex(key, node_info_a, node) {
    const node_info_b = node.get_data();

    if (Fkad_node._get_distance(key, node_info_a.node_id).less(
      Fkad_node._get_distance(key, node_info_b.node_id))) {
      return -1;
    } else if (Fkad_node._get_distance(key, node_info_a.node_id).greater(
      Fkad_node._get_distance(key, node_info_b.node_id))) {
      return 1;
    }

    const node_a_net_info = `${node_info_a.addr}${node_info_a.port}`;
    const node_b_net_info = `${node_info_b.addr}${node_info_b.port}`;
    return node_a_net_info.localeCompare(node_b_net_info);
  }

  /**
   * Perform one round of a node lookup for 'key', sending RPC 'rpc' to 'rsz' peers, given some 
   * state of active nodes and inactive nodes (as BSTs). 
   * 
   * If a value is found, we'll return a pair in the form of [payload, closest], where 'payload' is 
   * the Fkad_data.payload wrapping the value, and 'closest' is the BST node wrapping the 
   * closest active peer we heard of who didn't have the value. In many cases, 'closest' will be 
   * null, indicating that we didn't know of any other active peers at the time we found the value. 
   * 
   * If a value is not found, we return undefined.
   */ 
  async _do_node_lookup({active, inactive, rsz = Fkad_node.ALPHA, rpc, key} = {}) {
    const contacts = [];
    let node = inactive.bst_min();

    while (node !== null && contacts.length < rsz) {
      contacts.push(node);
      node = inactive.bst_successor(node);
    }

    const results = [];
    
    contacts.forEach((node) => {
      results.push(new Promise((resolve, reject) => {
        rpc.bind(this)(key, node.get_data(), (res, ctx) => {
          if (res.data.type === Fkad_data.TYPE.VAL) {
            Fkad_node._is_valid_storable(res.data.payload[0]).then((is_valid) => {
              resolve(is_valid ? [res.data.payload, active.bst_min()] : null);
            });

            return;
          } 

          active.bst_insert(
            new Fbintree_node({data: res.from}), 
            this._insert_by_xor_lex.bind(this, key)
          );
          
          inactive.bst_delete(node);

          res.data.payload.forEach((node_info) => {
            if (active.bst_search(this._search_by_xor_lex.bind(this, key), node_info) === null) {
              inactive.bst_insert(
                new Fbintree_node({data: node_info}), 
                this._insert_by_xor_lex.bind(this, key)
              );
            }
          });

          resolve(null);
        }, () => {
          inactive.bst_delete(node);
          resolve(null);
        });
      }));
    });

    return await Promise.all(results).then((values) => {
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] !== null) {
          return values[i];
        }
      }
    });
  }

  /**
   * Perform a complete node lookup for 'key'; 'rpc' is the RPC request function, one of either 
   * _req_find_node or _req_find_value; status callback 'cb' is updated with the number of active
   * and inactive nodes after each round
   * 
   * Returns an Fkad_data of either VAL or NODE_LIST type, depending on outcome
   */ 
  async node_lookup(key, rpc = this._req_find_node, cb = (n_active, n_inactive) => {}) {
    /**
     * Per the Kademlia spec section 2.3, to handle "pathological cases in which there are no lookups
     * for a particular ID range," we record the time at which we last performed a node lookup on
     * this bucket. The k-bucket refresh interval uses this time to determine which buckets to refresh
     */ 
    if (rpc === this._req_find_node) {
      this.find_kbucket_for_id(key).get_data().touch();
    }

    const active = new Fbintree();
    const inactive = new Fbintree();

    this._get_nodes_closest_to({key: key, max: Fkad_node.ALPHA}).forEach((node_info) => {
      inactive.bst_insert(new Fbintree_node({data: node_info}), this._insert_by_xor_lex.bind(this, key));
    });

    let last_closest;
    let val;
  
    while (active.size() < Fkad_node.K_SIZE && !val) {
      const closest = active.bst_min();
      const n_inactive = inactive.size();

      if (closest === last_closest && n_inactive === 0) {
        break;
      } else if (closest === last_closest && n_inactive > 0) {
        val = await this._do_node_lookup.bind(this, {
          active: active, 
          inactive: inactive, 
          rsz: n_inactive, 
          rpc: rpc, 
          key: key
        })();
      } else {
        last_closest = closest;
        val = await this._do_node_lookup.bind(this, {
          active: active, 
          inactive: inactive, 
          rpc: rpc, 
          key: key
        })();
      }

      cb(active.size(), n_inactive);
    }

    /**
     * CASE 1: A value lookup has successfully returned a value
     */ 
    if (val) {
      const [payload, closest] = val;

      /** 
       * Caching behavior upon successful lookup (section 2.3 in the Kademlia spec): we store the 
       * [key, val] pair at the closest node we observed to the key that did not return the value
       */ 
      if (closest !== null) {
        Flog.log(`[FKAD] Storing ${key} to keyspace owner ${closest.get_data().node_id}`);
        this._req_store(key, payload[0], closest.get_data());
      }

      return new Fkad_data({type: Fkad_data.TYPE.VAL, payload: payload});
    }

    /**
     * CASE 2: Either a value lookup has failed to return a value, or we performed a node lookup;
     * in both circumstances, we just return a sorted list of the closest nodes we heard about
     */ 
    const sorted = active.inorder((node, data) => {
      data.push(node.get_data());
      return data;  
    });

    return new Fkad_data({type: Fkad_data.TYPE.NODE_LIST, payload: sorted});
  }

  _req_ping(node_info, success, timeout, ttl) {
    const msg = new Fkad_msg({
      rpc: Fkad_msg.RPC.PING,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.REQ,
      id: Fbigint.unsafe_random(Fkad_node.ID_LEN)
    });

    this.eng._send(msg, node_info, success, timeout, ttl);
  }

  /**
   * In our network, STORE RPCs are always bearing PHT nodes, and so they're likely to be among the
   * largest data objects sent over the wire. Since peers defer the processing of large chunks of 
   * data until periods of downtime, we uniquely set a very long TTL here; if the recipient is very
   * busy, it might them a few seconds to get to it and send us a RES. TODO: see the roadmap for 
   * discussion about a future system to compute TTL based on outbound message size.
   */
  _req_store(key, val, node_info, success, timeout, ttl = 10000) {
    const msg = new Fkad_msg({
      rpc: Fkad_msg.RPC.STORE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.REQ,
      data: new Fkad_data({type: Fkad_data.TYPE.PAIR, payload: [key, val]}),
      id: Fbigint.unsafe_random(Fkad_node.ID_LEN)
    });

    this.eng._send(msg, node_info, success, timeout, ttl);
  }

  _req_find_node(key, node_info, success, timeout, ttl) {
    const msg = new Fkad_msg({
      rpc: Fkad_msg.RPC.FIND_NODE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.REQ,
      data: new Fkad_data({type: Fkad_data.TYPE.KEY, payload: [key]}),
      id: Fbigint.unsafe_random(Fkad_node.ID_LEN)
    });

    this.eng._send(msg, node_info, success, timeout, ttl);
  }

  _req_find_value(key, node_info, success, timeout, ttl) {
    const msg = new Fkad_msg({
      rpc: Fkad_msg.RPC.FIND_VALUE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.REQ,
      data: new Fkad_data({type: Fkad_data.TYPE.KEY, payload: [key]}),
      id: Fbigint.unsafe_random(Fkad_node.ID_LEN)
    });

    this.eng._send(msg, node_info, success, timeout, ttl); 
  }

  _res_ping(req) {
    return new Fkad_msg({
      rpc: Fkad_msg.RPC.PING,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.RES,
      data: new Fkad_data({type: Fkad_data.TYPE.STRING, payload: ["PONG"]}),
      id: req.id
    });
  }

  _res_store(req) {
    const [key, val] = req.data.payload;

    /**
     * We currently honor deletions from any peer by passing a null value. This functionality exists
     * solely to enable PHT merge operations to immediately remove trimmed nodes from the
     * topology. TODO: the deletion case should be moved into _is_valid_storable and should require
     * all the usual proofs of trustworthiness from the requester...
     */ 
    if (val === null) {
      this.data.delete(key);
      Flog.log(`[FKAD] Deleted ${key.toString()} from local storage via ${req.from.node_id}`);
      return;
    }

    Fkad_node._is_valid_storable(val).then((res) => {
      if (!res) {
        return;
      }

      /**
       * To determine TTL for this value, we estimate the number of nodes between us and the key.
       * What tree depth is the k-bucket for our node ID? What tree depth is the k-bucket for the
       * key? The difference betwen those depths approximates our distance from the key wrt the 
       * current topology of the routing table.
       */ 
      const d1 = this.find_kbucket_for_id(this.node_id).get_data().get_prefix().length;
      const d2 = this.find_kbucket_for_id(key).get_data().get_prefix().length;
      const ttl = Fkad_node.T_DATA_TTL * Math.pow(2, -(Math.max(d1, d2) - Math.min(d1, d2))); 

      this.data.put({
        key: key,
        val: val,
        ttl: ttl
      });

      Flog.log(`[FKAD] Added ${key.toString()} to local storage from ${req.from.node_id}`);
    });
    
    return new Fkad_msg({
      rpc: Fkad_msg.RPC.STORE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.RES,
      data: new Fkad_data({type: Fkad_data.TYPE.STRING, payload: ["OK"]}),
      id: req.id
    });
  }

  _res_find_node(req) {
    const nodes = this._get_nodes_closest_to({key: req.data.payload[0], max: Fkad_node.K_SIZE});

    return new Fkad_msg({
      rpc: Fkad_msg.RPC.FIND_NODE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.RES,
      data: new Fkad_data({type: Fkad_data.TYPE.NODE_LIST, payload: nodes}),
      id: req.id
    });
  }

  _res_find_value(req) {
    const key = req.data.payload[0];
    let ds_rec = this.data.get(key);
  
    /**
     * Lazy deletion: the requested data exists but has expired, so delete it from our data store
     */ 
    if (ds_rec && ds_rec.get_created() < (Date.now() - ds_rec.get_ttl())) {
      this.data.delete(key);
      ds_rec = undefined;
    }

    const data = ds_rec ? new Fkad_data({type: Fkad_data.TYPE.VAL, payload: [ds_rec.get_data()]}) : 
      new Fkad_data({type: Fkad_data.TYPE.NODE_LIST, payload: this._get_nodes_closest_to({key: key})});

    return new Fkad_msg({
      rpc: Fkad_msg.RPC.FIND_VALUE,
      from: new Fkad_node_info(this.node_info),
      type: Fkad_msg.TYPE.RES,
      data: data,
      id: req.id
    });
  }

  _on_req(msg) {
    const res = this.RPC_RES_EXEC.get(msg.rpc).bind(this)(msg);
    this.eng._send(res, msg.from);
  }

  /**
   * Fetch an array of the Fkad_node_infos in our routing table that are closest to 'key'
   * TODO: this is an unoptimized naive approach, we collect every node by traversing the entire
   * routing table, then sort by each node's distance from the key... an optimization approach might
   * be to start our search at the leaf node and visit adjacent buckets in the routing table by
   * their distance from our ID, ending the search when hit max, then sort by distance from the key
   */ 
  _get_nodes_closest_to({key, max = Fkad_node.K_SIZE, get_locked = false, get_stale = false} = {}) {
    const all_nodes = this.routing_table.dfs((node, data) => {
      const bucket = node.get_data();
      
      if (bucket !== null) {
        data = data.concat(bucket.to_array().filter((kbucket_rec) => {
          if (!get_locked && !get_stale) {
            return !kbucket_rec.is_locked() && !kbucket_rec.is_stale();
          } else if (get_locked && !get_stale) {
            return !kbucket_rec.is_stale();
          } else if (!get_locked && get_stale) {
            return !kbucket_rec.is_locked();
          } else {
            return true;
          }
        }));
      }

      return data;
    });

    const sorted_node_infos = all_nodes.map(kbucket_rec => kbucket_rec.node_info).sort((a, b) => 
      Fkad_node._get_distance(key, a.node_id).greater(Fkad_node._get_distance(key, b.node_id)) ? 
        1 : -1);

    return sorted_node_infos.splice(0, Math.min(max, sorted_node_infos.length));
  }

  _init_intervals() {
    /**
     * Bucket refresh interval
     */ 
    if (this.refresh_interval_handle === null) {
      this.refresh_interval_handle = setInterval(() => {
        const t_expiry = Date.now() - Fkad_node.T_KBUCKET_REFRESH;

        const all_buckets = this.routing_table.dfs((node, data) => {
          const bucket = node.get_data();

          if (bucket !== null) {
            data.push(bucket);
          }

          return data;
        });
      
        all_buckets.forEach((bucket) => {
          if (bucket.get_touched() < t_expiry) {
            this._refresh_kbucket(bucket);
          }
        });
      }, Fkad_node.T_KBUCKET_REFRESH);
    }

    Flog.log(`[FKAD] K-bucket refresh interval: ` + 
      `${(Fkad_node.T_KBUCKET_REFRESH / 60 / 1000).toFixed(1)} minutes`);

    /**
     * Data republish interval
     */ 
    if (this.republish_interval_handle === null) {
      this.republish_interval_handle = setInterval(async () => {
        /**
         * TODO: write republication logic, or eliminate this entirely - see publish() below
         */ 
      }, Fkad_node.T_REPUBLISH);
    }

    Flog.log(`[FKAD] Data republish interval: ` + 
      `${(Fkad_node.T_REPUBLISH / 60 / 60 / 1000).toFixed(1)} hours`);

    /**
     * Data replication interval
     */ 
    if (this.replicate_interval_handle === null) {
      this.replicate_interval_handle = setInterval(() => {
        this.data.entries().forEach((pair) => {
          const [key_str, ds_rec] = pair;
          const t1 = Date.now();

          // No one's issued a STORE on this data for a while? Let's do a PUT on it
          if (t1 > (ds_rec.get_created() + Fkad_node.T_REPLICATE) && 
            t1 < (ds_rec.get_created() + ds_rec.get_ttl())) {
            this.put(new Fbigint(key_str), ds_rec.get_data());
          }
        });
      }, Fkad_node.T_REPLICATE);
    }

    Flog.log(`[FKAD] Replication interval: ` + 
      `${(Fkad_node.T_REPLICATE / 60 / 60 / 1000).toFixed(1)} hours`);
  }

  _stop_intervals() {
    if (this.refresh_interval_handle) {
      clearInterval(this.refresh_interval_handle);
      this.refresh_interval_handle = null;
    }

    if (this.republish_interval_handle) {
      clearInterval(this.republish_interval_handle);
      this.republish_interval_handle = null;
    }

    if (this.replicate_interval_handle) {
      clearInterval(this.replicate_interval_handle);
      this.replicate_interval_handle = null;
    }
  }

  /**
   * Bootstrap onto a network. Supply the addr, port, and pubkey of the bootstrap node
   */ 
  async bootstrap({addr = null, port = null, pubkey = null} = {}) {
    this.net.network.on("message", this.eng._on_message.bind(this.eng));
    
    const node_info = new Fkad_node_info({
      addr: addr, 
      port: port, 
      pubkey: pubkey, 
      node_id: new Fbigint(Fcrypto.sha1(pubkey))
    });

    /**
     * This PING RPC is how we insert ourselves into the routing table of the bootstrap node. Since
     * peers determine whether to replicate their stored data to new peers at routing table insertion
     * time, this ping can result in a ton of large STORE RPCs which arrive before the pong. Our UDP
     * network controller implements message prioritization which ensures an orderly bootstrap 
     * procedure by processing the pong before getting to work processing the big chunks of data, but
     * if you're reading this from some strange future where we're using a non-UDP transport, beware!
     */ 
    const ping_res = await new Promise((resolve, reject) => {
      this._req_ping(
        node_info,
        (res, ctx) => resolve(res.from),
        () => resolve(null),
      );
    });

    if (ping_res === null) {
      Flog.log(`[FKAD] No PONG from bootstrap node ${addr}:${port}`);
      return false;
    }

    Flog.log(`[FKAD] Joining network as ${this.node_id.toString()} ` + 
      `via bootstrap node ${addr}:${port}...`);

    const bucket = this.find_kbucket_for_id(ping_res.node_id).get_data();
    bucket.enqueue(new Fkad_kbucket_rec({node_info: ping_res}));

    let last_active = 0;
    let last_inactive = 0;

    // Do a node lookup on myself, refresh every k-bucket further away from my closest neighbor
    const lookup_res = await this.node_lookup(
      this.node_id, 
      this._req_find_node, 
      (n_active, n_inactive) => {
        if (n_active !== last_active || n_inactive !== last_inactive) {
          Flog.log(`[FKAD] Node lookup: found ${n_active} peers, ${n_inactive} to query`);
        }

        last_active = n_active;
        last_inactive = n_inactive;
      }
    );
    
    const closest_nodes = lookup_res.payload.filter(node_info => !node_info.node_id.equals(this.node_id));
    const our_bucket = this.find_kbucket_for_id(this.node_id).get_data();

    for (let i = 1; i < closest_nodes.length; i += 1) {
      const bucket = this.find_kbucket_for_id(closest_nodes[i].node_id).get_data();

      if (bucket !== our_bucket) {
        this._refresh_kbucket(bucket);
      }
    }

    const npeers = this._get_nodes_closest_to({
      key: this.node_id, 
      max: Number.POSITIVE_INFINITY
    }).length;

    Flog.log(`[FKAD] Success: node ${this.node_id.toString()} is online! ` + 
      `(Discovered ${npeers} peers)`);

    this._init_intervals();
    return true;
  }

  stop() {
    this.net.network.removeListener("message", this.eng._on_message.bind(this.eng));
    this._stop_intervals();
    Flog.log(`[FKAD] Offline`);
  }

  /**
   * Put data to the distributed database; that is, issue a STORE RPC for some key/value pair to
   * the K_SIZE closest peers who own that partition of the keyspace. Returns the number of peers
   * that successfully stored the data.
   */
  async put(key, val) {
    const result = await this.node_lookup(key);
    const kclosest = result.payload;
    const p = [];
    let succ = 0;

    kclosest.forEach((node_info) => {
      p.push(new Promise((resolve, reject) => {
        this._req_store(key, val, node_info, (res, ctx) => {
          succ += 1;
          resolve();
        }, () => {
          resolve();
        });
      }));
    });

    await Promise.all(p);
    return succ;
  }

  /** Publish data to the distributed database. When we publish data, we will thereafter consider
   * ourselves the original publisher of that data, and we will accordingly maintain a record of
   * that data; this may have implications wrt our regular republication strategy. Notable here:
   * the Kademlia spec calls for publishers to re-publish their original data every 24 hours, but
   * this would clearly create problems when used with a PHT. Since all of our data objects are 
   * PHT nodes, and each PHT node on the network is subject to change (how many keys does it
   * currently hold? Is it currently a leaf node or an internal node? Has it since been deleted from
   * the topology entirely as a result of a merge operation?), republishing our original data will
   * typically result in stomping a PHT node somewhere on the DHT with a stale version of itself.
   * For our application, it's likely that publish() should be avoided in favor of put(), and 
   * republication logic should be deferred to the PHT layer.
   */
  async publish(key, val) {
    this.published.set(key.toString(), val);
    await this.put(key, val);
  }

  /**
   * Fetch data 'key' from the distributed database
   */ 
  async get(key) {
    return await this.node_lookup(key, this._req_find_value);
  }
}

module.exports.Fkad_node = Fkad_node;