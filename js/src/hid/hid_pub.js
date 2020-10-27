/** 
* HID_PUB
* A HID_PUB is the public half of our identity system
* It encapsulates identity info about a peer that's
* safe to share, and it enforces primitive types
* so that it's easy to serialize
*
*/ 

"use strict";

const { Hutil } = require("../hutil/hutil.js");

class Hid_pub {
	public_key;
	name;
	first;
	last;
	address;
	phone;
	lat;
	long;
	peer_id;

	constructor({public_key = null, name = null, first = null, last = null, address = null, phone = null, lat = null, long = null}  = {}) {
		// TODO: validation, enforce primitive types

		this.public_key = public_key;
		this.name = name; // TODO: name is for restaurants, where first/last are for people. Too complex?
		this.first = first;
		this.last = last;
		this.address = address;
		this.phone = phone;
		this.lat = lat;
		this.long = long;
		this.peer_id = Hutil._sha1(this.public_key);
	}
}

module.exports.Hid_pub = Hid_pub;