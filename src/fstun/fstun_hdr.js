/** 
* FSTUN_HDR
* STUN message header
* 
* 
* 
* 
*/ 

"use strict";

const { Futil } = require("../futil/futil.js"); 
const { Fstun_type_data } = require("./fstun_container.js");

class Fstun_hdr {
  static K_HDR_LEN = 20;
  static K_ID_LEN = 12;
  static K_MAGIC = new Buffer.from([0x21, 0x12, 0xA4, 0x42]);
  static K_MAGIC_OFF = [4, 8];
  static K_TYPE_OFF = [0, 2];
  static K_ID_OFF = [8, 20];
  static K_LEN_OFF = [2, 4];

  static K_MSG_TYPE = {
    BINDING_REQUEST: 0,     
    BINDING_INDICATION: 1,   
    BINDING_SUCCESS_RESPONSE: 2,
    BINDING_ERROR_RESPONSE: 3,
    MALFORMED: 4
  };

  static K_MSG_TYPE_TABLE = new Map([
    [
      new Buffer.from([0x00, 0x01]).toString("hex"), 
      new Fstun_type_data(this.K_MSG_TYPE.BINDING_REQUEST, new Buffer.from([0x00, 0x01]))
    ],
    [
      new Buffer.from([0x00, 0x11]).toString("hex"), 
      new Fstun_type_data(this.K_MSG_TYPE.BINDING_INDICATION, new Buffer.from([0x00, 0x11]))
    ],
    [
      new Buffer.from([0x01, 0x01]).toString("hex"), 
      new Fstun_type_data(this.K_MSG_TYPE.BINDING_SUCCESS_RESPONSE, new Buffer.from([0x01, 0x01]))
    ],
    [
      new Buffer.from([0x01, 0x11]).toString("hex"), 
      new Fstun_type_data(this.K_MSG_TYPE.BINDING_ERROR_RESPONSE, new Buffer.from([0x01, 0x11]))
    ]
  ]);

  // TODO: Validation
  constructor({type = null, len = null, id = null, magic = Fstun_hdr.K_MAGIC} = {}) {
    this.type = typeof type === "number" ? Fstun_hdr._enType(type) : type;
    this.len = typeof len === "number" ? Fstun_hdr._enLen(len) : len;
    this.magic = Buffer.from(magic);
    this.id = Buffer.isBuffer(id) ? Buffer.from(id) : id;
  }

  // TODO: Validation
  static from({type = null, len = null, id = null, magic = Fstun_hdr.K_MAGIC} = {}) {
    const hdr = new this;

    hdr.type = type;
    hdr.len = len;
    hdr.magic = magic;
    hdr.id = id;
  
    return hdr;
  }

  static _isValidMsb(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 1) {
      throw new Error("buf must be Buffer with a length > 0");
    }

    if (Futil.get_bit(buf, 0, 6) || Futil.get_bit(buf, 0, 7)) {
      return false;
    }

    return true;
  }

  static _isValidMagic(magic) {
    return Buffer.compare(magic, this.K_MAGIC) === 0 ? true : false;
  }

  static _decType(type) {
    if (!Buffer.isBuffer(type) || type.length !== 2) {
      throw new Error("type must be Buffer with length of 2");
    }

    const dtype = this.K_MSG_TYPE_TABLE.get(type.toString("hex"));

    if (dtype !== undefined) {
      return dtype;
    }
    
    return new Fstun_type_data(this.K_MSG_TYPE.MALFORMED);
  }

  static _decLen(len) {
    if (!Buffer.isBuffer(len) || len.length !== 2) {
      throw new Error("len must be Buffer with length of 2");
    }

    return len.readUInt16BE();
  }

  static _enType(type) {
    if (typeof type !== "number") {
      throw new Error("type must be number");
    }

    const tdata = Array.from(this.K_MSG_TYPE_TABLE.values())[type];
    return Buffer.from(tdata.bin);
  }

  static _enLen(len) {
    if (typeof len !== "number") {
      throw new Error("len must be number");
    }
    
    return Futil.wbuf_uint16be(len); 
  }

  serialize() {
    return Buffer.concat([this.type, this.len, this.magic, this.id]);
  }
}

module.exports.Fstun_hdr = Fstun_hdr;