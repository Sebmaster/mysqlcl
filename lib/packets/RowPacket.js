/**
 * A column packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function RowPacket(packet, binary, autoBox) {
	var index = {index: 0};
	this.data = [];
	
	if (binary) {
		var nullmap = ~~((binary.length+9)/8)-1;
		packet.data[1] >>= 2;
		if (binary.length < 6) {
			packet.data[1] >>= 5-binary.length;
		}
		var temp = binary.length < 6 ? binary.length : 6;
		for (var i=0; i < temp; ++i) {
			this.data[i] = packet.data[1] & 1 ? null : 0;
			packet.data[1] >>= 1;
		}
		
		for (var i=0; i < nullmap; ++i) {
			var cache = 6+i*8,
				temp = binary.length-cache < 8 ? binary.length-cache : 8;
			for (var j=0; j < temp; ++j) {
				this.data[cache+j] = packet.data[i+2] & 1 ? null : 0;
				packet.data[i+2] >>= 1;
			}
		}
		var idx = {index: nullmap+2};
		for (var i=0; i < binary.length; ++i) {
			if (this.data[i] === null) continue;
			this.data[i] = RowPacket.convertBinary(packet.data, binary[i].type, idx);
		}
	} else {
		if (autoBox) {
			while (index.index < packet.length) {
				this.data[this.data.length] = packet.getLCBString(index);
			}
		} else {
			while (index.index < packet.length) {
				this.data[this.data.length] = packet.getLCBString(index);
			}
		}
	}
}

RowPacket.convertBinary = function(value, type, i) { // TODO: Implement more types.
	switch (type) {
		case 0: // DECIMAL
			break;
		case 1: //TINY
			return value[i.index++];
			break;
		case 2: // SHORT
			return value[i.index++] + (value[i.index++] << 8);
			break;
		case 3: // LONG
			return value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 24);
			break;
		case 4: // FLOAT
			break;
		case 5: // DOUBLE
			break;
		case 6: // NULL
			return null;
			break;
		case 7: // TIMESTAMP
			break;
		case 8: // LONGLONG
			break;
		case 9: // INT24/MEDIUMINT
			return value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16);
			break;
		case 10: // DATE
			break;
		case 11: // TIME
			break;
		case 12: // DATETIME
			break;
		case 13: // YEAR
			break;
		case 14: // NEWDATE
			return null; // Can't encounter this datatype :(
			break;
		case 15: // VARCHAR
			break;
		case 16: // BIT
			return value[i.index++] === 0 ? false : true;
			break;
		case 246: // NEWDECIMAL
			break;
		case 247: // ENUM
			break;
		case 248: // SET
			break;
		case 249: // TINYBLOB
			break;
		case 250: // MEDIUMBLOB
			break;
		case 251: // LONGBLOB
			break;
		case 252: // BLOB
			break;
		case 253: // VARSTRING
			break;
		case 254: // STRING
			return value.toString();
			break;
		case 255: // GEOMETRY
			break;
	}
};

/**
 * Converts the mysql datatype to a javascript one.
 * 
 * @param {string} value the value to convert
 * @param {number} type the type to convert to
 */
RowPacket.autoBox = function(value, type) {
	switch (type) {
		case 0x00:
		case 0x04:
		case 0x05:
		case 0xF6:
			return parseFloat(value);
			break;
		case 0x01:
		case 0x02:
		case 0x03:
		case 0x07:
		case 0x08:
		case 0x09:
		case 0x0D:
			return parseInt(value);
			break;
		case 0x06:
			return null;
			break;
		case 0x0A:
		case 0x0C:
		case 0x0E:
			return new Date(value);
			break;
		case 0x10:
			return value === '\u0000' ? false : true;
			break;
		default:
			return value;
			break;
	}
};

/**
 * The row data
 * 
 * @type {Array.<*>}
 */
RowPacket.prototype.data = null;

exports.RowPacket = RowPacket;