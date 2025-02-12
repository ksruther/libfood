/** 
* FSTUN_ATTR
* STUN message attribute
* 
* 
* 
* 
*/ 

"use strict";

const { Fstun_hdr } = require("./fstun_hdr.js");
const { Fstun_type_data } = require("./fstun_container.js");
const { Futil } = require("../futil/futil.js"); 

class Fstun_attr {
  static K_ALIGN = 4;
  static K_SOFTWARE = "software attribute TBD";
  static K_TYPE_OFF = [0, 2]; 
  static K_LEN_OFF = [2, 4];
  static K_LEN_LEN = this.K_LEN_OFF[1] - this.K_LEN_OFF[0]; 
  static K_TYPE_LEN = this.K_TYPE_OFF[1] - this.K_TYPE_OFF[0];

  static K_ATTR_TYPE = {
    RESERVED_0000: 0,
    MAPPED_ADDRESS: 1,
    RESERVED_0002: 2,
    RESERVED_0003: 3,
    RESERVED_0004: 4,
    RESERVED_0005: 5,
    USERNAME: 6,
    RESERVED_0007: 7,
    MESSAGE_INTEGRITY: 8,
    ERROR_CODE: 9,
    UNKNOWN_ATTRIBUTES: 10,
    RESERVED_000B: 11,
    REALM: 12,
    NONCE: 13,
    XOR_MAPPED_ADDRESS: 14,
    SOFTWARE: 15,
    ALTERNATE_SERVER: 16,
    FINGERPRINT: 17,
    MALFORMED: 18
  };

  static K_ATTR_TYPE_TABLE = new Map([
    [
      new Buffer.from([0x00, 0x00]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0000, new Buffer.from([0x00, 0x00]))
    ],
    [
      new Buffer.from([0x00, 0x01]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.MAPPED_ADDRESS, new Buffer.from([0x00, 0x01]), this._enMappedAddr)
    ],
    [
      new Buffer.from([0x00, 0x02]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0002, new Buffer.from([0x00, 0x02]))
    ],
    [
      new Buffer.from([0x00, 0x03]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0003, new Buffer.from([0x00, 0x03]))
    ],
    [
      new Buffer.from([0x00, 0x04]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0004, new Buffer.from([0x00, 0x04]))
    ],
    [
      new Buffer.from([0x00, 0x05]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0005, new Buffer.from([0x00, 0x05]))
    ],
    [
      new Buffer.from([0x00, 0x06]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.USERNAME, new Buffer.from([0x00, 0x06]))
    ],
    [
      new Buffer.from([0x00, 0x07]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_0007, new Buffer.from([0x00, 0x07]))
    ],
    [
      new Buffer.from([0x00, 0x08]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.MESSAGE_INTEGRITY, new Buffer.from([0x00, 0x08]))
    ],
    [
      new Buffer.from([0x00, 0x09]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.ERROR_CODE, new Buffer.from([0x00, 0x09]), this._enErrorCode)
    ],
    [
      new Buffer.from([0x00, 0x0A]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.UNKNOWN_ATTRIBUTES, new Buffer.from([0x00, 0x0A]), this._enUnknownAttr)
    ],
    [
      new Buffer.from([0x00, 0x0B]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.RESERVED_000B, new Buffer.from([0x00, 0x0B]))
    ],
    [
      new Buffer.from([0x00, 0x14]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.REALM, new Buffer.from([0x00, 0x14]))
    ],
    [
      new Buffer.from([0x00, 0x15]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.NONCE, new Buffer.from([0x00, 0x15]))
    ],
    [
      new Buffer.from([0x00, 0x20]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.XOR_MAPPED_ADDRESS, new Buffer.from([0x00, 0x20]), this._enMappedAddr)
    ],
    [
      new Buffer.from([0x80, 0x22]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.SOFTWARE, new Buffer.from([0x80, 0x22]), this._enSoftware)],
    [
      new Buffer.from([0x80, 0x23]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.ALTERNATE_SERVER, new Buffer.from([0x80, 0x23]))
    ],
    [
      new Buffer.from([0x80, 0x28]).toString("hex"), 
      new Fstun_type_data(this.K_ATTR_TYPE.FINGERPRINT, new Buffer.from([0x80, 0x28]))
    ]
  ]);

  static K_ADDR_FAMILY = {
    IPv4: 0,
    IPv6: 1,
    MALFORMED: 2
  };

  static K_ADDR_FAMILY_TABLE = new Map([
    [
      new Buffer.from([0x01]).toString("hex"), 
      new Fstun_type_data(this.K_ADDR_FAMILY.IPv4, new Buffer.from([0x01]))
    ],
    [
      new Buffer.from([0x02]).toString("hex"), 
      new Fstun_type_data(this.K_ADDR_FAMILY.IPv6, new Buffer.from([0x02]))
    ]
  ]);

  static K_ERROR_CODE = {
    300: "Try Alternate",
    400: "Bad Request",
    401: "Unauthorized",
    420: "Unknown Attribute",
    438: "Stale Nonce",
    500: "Server Error"
  };

  // TODO: Validation
  constructor({type = null, args = []} = {}) {
    this.type = type ? Fstun_attr._enType(type) : type;
    this.val = type ? Array.from(Fstun_attr.K_ATTR_TYPE_TABLE.values())[type].f(...args) : null;
    this.len = type ? Fstun_attr._enLen(this.val.length) : null;
  }

  // TODO: Validation
  static from({type = null, len = null, val = null} = {}) {
    const attr = new this;

    attr.type = type;
    attr.len = len;
    attr.val = val;

    return attr;
  }

  static _isCompReq(type) {
    if (!Buffer.isBuffer(type) || type.length !== 2) {
      throw new Error("type must be Buffer with length of 2");
    }
    
    if (type.readUInt16BE() < 0x8000) {
      return false;
    } 

    return true;
  }

  static _decType(type) {
    if (!Buffer.isBuffer(type) || type.length !== 2) {
      throw new Error("type must be Buffer with length of 2");
    }

    const dtype = this.K_ATTR_TYPE_TABLE.get(type.toString("hex"));

    if (dtype !== undefined) {
      return dtype;
    }
    
    return new Fstun_type_data(this.K_ATTR_TYPE.MALFORMED);
  }

  static _decLen(len) {
    if (!Buffer.isBuffer(len) || len.length !== 2) {
      throw new Error("len must be Buffer with length of 2");
    }

    const buf = Uint8Array.from(len);
    buf.reverse();

    const view = new Uint16Array(buf.buffer);
    return view[0];
  }

  static _decFam(fam) {
    if (!Buffer.isBuffer(fam) || fam.length !== 1) {
      throw new Error("fam must be Buffer with length of 1");
    }

    const dfam = this.K_ADDR_FAMILY_TABLE.get(fam.toString("hex"));

    if (dfam !== undefined) {
      return dfam;
    }

    return new Fstun_type_data(this.K_ADDR_FAMILY.MALFORMED);
  }

  static _enType(type) {
    if (typeof type !== "number") {
      throw new Error("type must be number");
    }

    const tdata = Array.from(this.K_ATTR_TYPE_TABLE.values())[type];

    if (!tdata) {
      throw new Error(`Invalid value for type: ${type}`);
    }

    return Buffer.from(tdata.bin);
  }

  static _enLen(len) {
    if (typeof len !== "number") {
      throw new Error("len must be number");
    }

    return Futil.wbuf_uint16be(len);
  }

  static _enFam(fam) {
    if (typeof fam !== "number") {
      throw new Error("fam must be number");
    }

    const tdata = Array.from(this.K_ADDR_FAMILY_TABLE.values())[fam];

    if (!tdata) {
      throw new Error(`Invalid value for fam: ${fam}`);
    }

    return Buffer.from(tdata.bin);
  }

  // TODO: Validation
  static _enMappedAddr(famType, addrStr, portInt, xor = false, id = Buffer.alloc(12)) {
    const zero = Buffer.alloc(1);
    const fam = Fstun_attr._enFam(famType);
    const port = Futil.wbuf_uint16be(portInt);
    let addr;


    if (famType === Fstun_attr.K_ADDR_FAMILY.IPv4) {
      addr = Futil.ipv4_str_to_buf32(addrStr);
    } else if (famType === Fstun_attr.K_ADDR_FAMILY.IPv6) {
      addr = Futil.ipv6_str_to_buf128(addrStr);
    }

    if (xor) {
      for (let i = 0; i < port.length; i += 1) {
        port[i] ^= Fstun_hdr.K_MAGIC[i]; 
      }

      const c = Buffer.concat([Fstun_hdr.K_MAGIC, id]);

      for (let i = 0; i < addr.length; i += 1) {
        addr[i] ^= c[i];
      }
    }

    return Buffer.concat([zero, fam, port, addr]);
  }
  
  // TODO: this is noob rating 10/10
  static _decMappedAddr(buf, id, xor = false) {
    const famType = Fstun_attr._decFam(buf.slice(1, 2));
    const port = buf.slice(2, 4);
    const addr = buf.slice(4, buf.length);

    if (xor) {
      for (let i = 0; i < port.length; i += 1) {
        port[i] ^= Fstun_hdr.K_MAGIC[i];
      }

      const c = Buffer.concat([Fstun_hdr.K_MAGIC, id]);

      for (let i = 0; i < addr.length; i += 1) {
        addr[i] ^= c[i];
      }
    }
        
    let decoded_addr;

    if (famType.type === Fstun_attr.K_ADDR_FAMILY.IPv4) {
      decoded_addr = Futil.buf32_to_ipv4_str(addr);
    } else if (famType.type === Fstun_attr.K_ADDR_FAMILY.IPv6) {
      decoded_addr = Futil.buf128_to_ipv6_str(addr);
    }

    // Interpret port as a 16-bit unsigned int without using Buffer API
    return [decoded_addr, port[1] | (port[0] << 8)]; 
  }

  // TODO: Validation
  static _enErrorCode(code) {
    const resClass = Buffer.alloc(3);
    resClass[2] = Math.floor(code / 100);
    
    const num = Buffer.from([code % 100]); 
    const phrase = Buffer.from(Fstun_attr.K_ERROR_CODE[code]);

    return Buffer.concat([resClass, num, phrase]);
  }

  // TODO: Validation
  static _enUnknownAttr(types) {
    const uknowns = Buffer.concat(types.map((type) => { 
      return Buffer.from(type);
    }));

    return Fstun_attr._toPadded(uknowns);
  }

  static _enSoftware(desc = Fstun_attr.K_SOFTWARE) {
    return Fstun_attr._toPadded(Buffer.from(desc));
  } 

  static _toPadded(buf) {
    return Buffer.concat([
      buf,
      Buffer.alloc(Math.ceil(buf.length / Fstun_attr.K_ALIGN) * Fstun_attr.K_ALIGN - buf.length)
    ]);
  }

  length() {
    return (this.type.length + this.len.length + this.val.length);
  }

  serialize() {
    return Buffer.concat([this.type, this.len, this.val]);
  }
}

module.exports.Fstun_attr = Fstun_attr;
