/** 
* FKAD_DATA
* Encapsulates any kind of data that may be sent in a Kademlia message
* 
*
*
*
*/ 

"use strict";

class Fkad_data {
  static TYPE = {
    STRING: 0,
    NODE_LIST: 1,
    PAIR: 2,
    KEY: 3,
    VAL: 4
  };

  type;
  payload;

  constructor({type = null, payload = null} = {}) {
    if (type === null || !Array.isArray(payload) || payload.length < 1) {
      throw new Error("Argument error");
    }

    this.type = type;
    this.payload = payload;
  }

  static get_type(data) {
    return data.type;
  }

  static get_payload(data) {
    return [...data.payload];
  }
}

module.exports.Fkad_data = Fkad_data;