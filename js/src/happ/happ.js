/** 
* HAPP 
* Top level protocol interface
*
*
*
*
*/ 

"use strict";

const { Happ_env } = require("./happ_env.js");
const { Happ_peer_data } = require("./happ_peer_data.js");
const { Htrans_udp } = require("../htrans/trans/htrans_udp.js");
const { Hkad_node } = require("../hkad/hkad_node.js");
const { Hkad_eng_alpha } = require("../hkad/eng/hkad_eng_alpha.js");
const { Hkad_net_solo } = require("../hkad/net/hkad_net_solo.js");
const { Hkad_net_sim } = require("../hkad/net/hkad_net_sim.js");
const { Hgeo_coord } = require("../hgeo/hgeo_coord.js");
const { Hgeo_rect } = require("../hgeo/hgeo_rect.js");
const { Hpht } = require("../hpht/hpht.js");
const { Hstun } = require("../hstun/hstun.js");
const { Hstun_net_solo } = require("../hstun/net/hstun_net_solo.js");
const { Hbuy } = require("../hbuy/hbuy.js");
const { Hbuy_net_solo } = require("../hbuy/net/hbuy_net_solo.js");
const { Hutil } = require("../hutil/hutil.js"); 
const { Hbigint } = Happ_env.BROWSER ? require("../htypes/hbigint/hbigint_browser.js") : require("../htypes/hbigint/hbigint_node.js");

class Happ {
	static GEO_INDEX_ATTR = "___h34v3n.geoha$h!!";

	static BOOTSTRAP_NODES = [
		["66.228.34.29", 27500]
	];

	port;
	hid;
	hpht;
	hbuy;
	node;

	// Currently we can only create one kind of Happ instance - it implements a single UDP transport module, full STUN services,
	// a DHT peer with a node id equal to the hash of the z-curve linearization of our lat/long coords, and a PHT interface (indexing on GEO_INDEX_ATTR)
	// TODO: Parameterize this to create different kinds of Happ instances
	constructor({hid = null, port = 27500} = {}) {
		// Give JavaScript's built-in Map type a serializer and a deserializer
		Object.defineProperty(global.Map.prototype, "toJSON", {
			value: Hutil._map_to_json
		});

		Object.defineProperty(global.Map, "from_json", {
			value: Hutil._map_from_json
		});

		this.port = port;
		this.hid = hid;
		this.hpht = null;
		this.hbuy = null;
		this.node = null;
	}

	// Return a reference to our DHT node
	get_node() {
		return this.node;
	}

	// Get our peer ID
	get_id() {
		return this.hid.peer_id;
	}

	// Return a reference to our latitude/longitude as an Hgeo_coord
	get_location() {
		return new Hgeo_coord({lat: this.hid.lat, long: this.hid.long});
	}

	// Search the network for the Hkad_node_info object for a given node_id as Hbigint (returns null if unable to resolve)
	async search_node_info(node_id) {
		const data = await this.node._node_lookup(node_id);

		if (data.payload[0].node_id.equals(node_id)) {
			return data.payload[0];
		}

		return null;
	}

	// Put a Happ_peer_data object associated with our geolocation to the network
	async put(peer_data) {
		if (!(peer_data instanceof Happ_peer_data)) {
			throw new TypeError("Argument 'peer_data' must be an Happ_peer_data object");
		}

		await this.hpht.insert(this.get_location().linearize(), peer_data);
	}

	// Search the network for data within a geographic window defined by an Hgeo_rect
	async geosearch(rect) {
		return await this.hpht.range_query_2d(rect.get_min().linearize(), rect.get_max().linearize());
	}

	// Boot this instance and join the network
	// To boot as a bootstrap node, pass addr and port
	async start({addr = null, port = null} = {}) {
		// Create and boot a UDP transport module
		const happ_udp_trans = new Htrans_udp({port: this.port});
		await happ_udp_trans._start();

		// Create and start STUN services
		const happ_stun_net = new Hstun_net_solo(happ_udp_trans);
		const happ_stun_service = new Hstun({net: happ_stun_net});

		let addr_port = null;

		if (addr !== null && port !== null) {
			addr_port = [addr, port];
		} else {
			// Try all of our known bootstrap nodes' STUN servers to resolve our external addr and port (we only need one response)
			for (let i = 0; i < Happ.BOOTSTRAP_NODES.length && addr_port === null; i += 1) {
				addr_port = await happ_stun_service._binding_req(Happ.BOOTSTRAP_NODES[i][0], Happ.BOOTSTRAP_NODES[i][1]);
			}
		}

		if (addr_port === null) {
			throw new Error("STUN binding request failed!");
		}

		// Create a DHT node
		const peer_node = new Hkad_node({
			eng: new Hkad_eng_alpha(), 
			net: new Hkad_net_solo(happ_udp_trans), 
			addr: addr_port[0],
			port: addr_port[1],
			id: this.get_id()
		});

		this.node = peer_node;

		// TODO: Should we bootstrap with more than one node? Bootstrap with every bootstrap node in our list?
		let bootstrap_res = false;

		for (let i = 0; i < Happ.BOOTSTRAP_NODES.length && bootstrap_res === false; i += 1) {
			bootstrap_res = await peer_node.bootstrap({addr: Happ.BOOTSTRAP_NODES[i][0], port: Happ.BOOTSTRAP_NODES[i][1]});
		}

		if (!bootstrap_res) {
			throw new Error("DHT bootstrap failed!");
		}

		// Create a PHT interface
		this.hpht = new Hpht({
			index_attr: Happ.GEO_INDEX_ATTR,
			dht_lookup_func: peer_node._node_lookup, 
			dht_lookup_args: [peer_node._req_find_value], 
			dht_node: peer_node,
			dht_ttl: Hkad_node.T_DATA_TTL
		});

		// Idempotently initialize the PHT
		await this.hpht.init();

		// Create and start an HBUY interface
		const happ_hbuy_net = new Hbuy_net_solo(happ_udp_trans);
		this.hbuy = new Hbuy({net: happ_hbuy_net});
		this.hbuy.start();
	}

	// Disconnect from the network (currently only works with the one kind of Happ instance we can create)
	async stop() {
		try {
			if (this.node.net.trans) {
				this.node.net.trans._stop()
				this.hpht = null;
				this.node = null;
			}
		} catch {
			// Do nothing
		}
	}

	// Perform a network test by pinging all our bootstrap nodes in a random sequence - returns IP addr of first PONG, null if network failure
	async net_test() {
		if (!this.node) {
			return null;
		}

		const bstrap = Array.from(Happ.BOOTSTRAP_NODES);

		while (bstrap.length > 0) {
			const peer = bstrap.splice(Math.floor(Math.random() * bstrap.length), 1);

			const res = await new Promise((resolve, reject) => {
				this.node._req_ping({addr: peer[0][0], port: peer[0][1], node_id: new Hbigint(-1)}, (res, ctx) => { 
					resolve(peer[0][0]);
				}, () => {
					resolve(null);
				});
			});

			if (res) {
				return res;
			}
		}

		return null;
	}

	// Boot this instance on a local network simulation
	// local_sim must be an instance of Hkad_net_sim (to assign local_sim as this node's net module, set use_local_sim to true)
	// To make this node a bootstrap node, just don't supply a value for bootstrap_node
	async _debug_sim_start({bootstrap_node = null, local_sim = null, random_id = true, use_local_sim = false} = {}) {
		// Create a DHT node
		const peer_node = new Hkad_node({
			eng: new Hkad_eng_alpha(), 
			net: use_local_sim ? local_sim : new Hkad_net_sim(), 
			id: random_id ? null : this.get_id()
		});

		this.node = peer_node;
	
		local_sim._add_peer(peer_node);
		await this.node.bootstrap(bootstrap_node === null ? peer_node.node_info : bootstrap_node.get_node());

		// Create a PHT interface
		this.hpht = new Hpht({

			index_attr: Happ.GEO_INDEX_ATTR,
			dht_lookup_func: peer_node._node_lookup, 
			dht_lookup_args: [peer_node._req_find_value], 
			dht_node: peer_node,
			dht_ttl: Hkad_node.T_DATA_TTL
		});

		// Idempotently initialize the PHT
		await this.hpht.init();
		console.log("");
	}
}

module.exports.Happ = Happ;