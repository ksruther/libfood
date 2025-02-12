/** 
* FGEO_COORD
* Latidude/longitude coordinate pair
*
*
*
*
*/ 

"use strict";

const { Futil } = require("../futil/futil.js");

class Fgeo_coord {
  static LIMITS = {
    LAT_MAX: 90,
    LAT_MIN: -90,
    LONG_MAX: 180,
    LONG_MIN: -180
  };

  lat;
  long;

  constructor({lat = null, long = null} = {}) {
    if (typeof lat !== "number" || typeof long !== "number") {
      throw new Error("Arguments 'lat' and 'long' must be numbers");
    }

    if (lat < Fgeo_coord.LIMITS.LAT_MIN || lat > Fgeo_coord.LIMITS.LAT_MAX) {
      throw new RangeError("Latitude out of range");
    }

    if (long < Fgeo_coord.LIMITS.LONG_MIN || long > Fgeo_coord.LIMITS.LONG_MAX) {
      throw new RangeError("Longitude out of range");
    }

    this.lat = lat;
    this.long = long;
  }

  /**
   * Map this 2D coordinate pair to one dimension using a space-filling curve. 'b' is the bit 
   * depth per dimension -- i.e., for b = 40, then the 1D representation will fit into 80 bits
   */
  linearize(b = 40) {
    const lat = Futil.float_to_normalized_int(this.lat + Math.abs(Fgeo_coord.LIMITS.LAT_MIN), 
      Fgeo_coord.LIMITS.LONG_MAX + Math.abs(Fgeo_coord.LIMITS.LONG_MIN), b);
    
    const long = Futil.float_to_normalized_int(this.long + Math.abs(Fgeo_coord.LIMITS.LONG_MIN), 
      Fgeo_coord.LIMITS.LONG_MAX + Math.abs(Fgeo_coord.LIMITS.LONG_MIN), b);
    
    return Futil.z_linearize_2d(lat, long, b);
  }
}

module.exports.Fgeo_coord = Fgeo_coord;