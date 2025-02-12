/** 
* FDLT_STORE
* An FDLT data store
* 
* 
*
*
*/ 

"use strict";

const { Fdlt_block } = require("./fdlt_block.js");
const { Fntree } = require("../ftypes/fntree/fntree.js");
const { Fntree_node } = require("../ftypes/fntree/fntree_node.js");

/**
 * An Fdlt_store combines a tree with a Map such that we can maintain the branching hierarchy
 * for a chain of blocks and also fetch blocks in O(1). TODO: currently there's no insertion
 * operation, and we're leaving it up to the caller to modify the underlying tree and call
 * build_dict()... this should be unified under a much simpler interface.
 */ 

class Fdlt_store {
  static GENESIS = {
    hash_prev: 0x00,
    hash_merkle_root: 0x00,
    nonce: "00",
    tsacts: []
  };

  tree;
  dict;

  constructor(tree = new Fntree(new Fntree_node({data: Fdlt_store.GENESIS}))) {
    this.tree = tree;
    this.dict = new Map();
    this.build_dict();
  }

  build_dict() {
    this.dict.clear();

    this.tree.dfs((node, data) => {
      this.dict.set(Fdlt_block.sha256(node.data), node);
    }, (node, data) => {}, this.tree.get_root());
  }

  /**
   * Fetch a node from the tree by block hash, returns undefined if not found
   */ 
  get_node(hash) {
    return this.dict.get(hash);
  }

  /**
   * Collect a branch of the tree, in order, ending with last_node. TODO: this is O(n) :(
   */ 
  get_branch(last_node) {
    const branch = [];

    while (last_node !== null) {
      branch.unshift(last_node);
      last_node = last_node.parent;
    }

    return branch;
  }

  /**
   * Fetch the current size of the store as number of total blocks
   */ 
  size() {
    return this.dict.size;
  }

  /**
   * Get the tree nodes corresponding to the deepest blocks in the tree. In a tree where there is 
   * one longest branch, this will return one node
   */ 
  get_deepest_blocks() {
    const pg = this.tree.bfs((node, d, data) => {
      data.push([node, d]);
    });

    const max_d = Math.max(...pg.map(pair => pair[1]));
    return pg.filter(pair => pair[1] === max_d).map(pair => pair[0]);
  }
};

module.exports.Fdlt_store = Fdlt_store;