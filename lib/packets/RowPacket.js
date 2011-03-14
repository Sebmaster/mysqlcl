/**
 * A column packet
 * 
 * @constructor
 * @param {Packet} packet the sent packet
 */
function RowPacket(packet, columns, binary, autoBox) {
	var index = {index: 0};
	this.data = [];
	
	if (binary) {
		var nullmap = ~~((columns.length+9)/8)-1;
		packet.data[1] >>= 2;
		if (columns.length < 6) {
			packet.data[1] >>= 5-binary.length;
		}
		var temp = columns.length < 6 ? columns.length : 6;
		for (var i=0; i < temp; ++i) {
			this.data[i] = packet.data[1] & 1 ? null : 0;
			packet.data[1] >>= 1;
		}
		
		for (var i=0; i < nullmap; ++i) {
			var cache = 6+i*8,
				temp = columns.length-cache < 8 ? columns.length-cache : 8;
			for (var j=0; j < temp; ++j) {
				this.data[cache+j] = packet.data[i+2] & 1 ? null : 0;
				packet.data[i+2] >>= 1;
			}
		}
		var idx = {index: nullmap+2};
		for (var i=0; i < columns.length; ++i) {
			if (this.data[i] === null) continue;
			this.data[i] = RowPacket.convertBinary(packet, columns[i], idx);
		}
	} else {
		if (autoBox) {
			var data;
			while (index.index < packet.length) {
				data = packet.getLCBString(index);
				this.data[this.data.length] = data !== null ? RowPacket.autoBox(data, columns[this.data.length].type) : null;
			}
		} else {
			while (index.index < packet.length) {
				this.data[this.data.length] = packet.getLCBString(index);
			}
		}
	}
}

RowPacket.convertBinary = function(packet, column, i) { // TODO: Implement more types.
	var value = packet.data;
	switch (column.type) {
		case 0: // DECIMAL
			return;
		case 1: //TINY
			return value[i.index] > 127 && (column.flags & 32) === 0 ? value[i.index++] - 256 : value[i.index++];
		case 2: // SHORT
			var num = value[i.index++] + (value[i.index++] << 8);
			return num > 32767 && (column.flags & 32) === 0 ? num - 65536 : num;
		case 3: // LONG
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + (value[i.index++] << 24);
			return num > 2147483647 && (column.flags & 32) === 0 ? num - 4294967295 : num;
		case 4: // FLOAT
			var data = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + (value[i.index++] * 16777216),
				sign = data & 2147483648 ? -1 : 1,
				exponent = (data & 2139095040) / 8388608,
				number = (data & 8388607) + 8388608;
			if (exponent === 0x00 && number === 8388608) {
				return 0;
			} else if (exponent === 0x00) {
				exponent = 1;
			} else if (exponent === 0xFF) {
				return number === 8388608 ? sign * Infinity : NaN;
			}
			return number * sign * Math.pow(2, exponent-150);
		case 5: // DOUBLE
			var mantissa = value[i.index++] / 4503599627370496 +
						   value[i.index++] / 17592186044416 +
						   value[i.index++] / 68719476736 +
						   value[i.index++] / 268435456 +
						   value[i.index++] / 1048576 +
						   value[i.index++] / 4096 +
						   (value[i.index] & 15) / 16;
			
			var exponent = (value[i.index++] >> 4) + ((value[i.index] & 127) << 4);
			var sign = value[i.index] & 128 ? -1 : 1;
			
			if (exponent === 0x00 && mantissa === 0) {
				return 0;
			} else if (exponent === 0x00) {
				exponent = 1;
			} else if (exponent === 0x7FF) {
				return mantissa === 0 ? sign * Infinity : NaN;
			}
			return (1 + mantissa) * sign * Math.pow(2, exponent-1023);
		case 6: // NULL
			return null;
		case 7: // TIMESTAMP
		case 12: // DATETIME
			var len = value[i.index++],
				y = value[i.index++] + (value[i.index++] << 8),
				m = value[i.index++],
				d = value[i.index++];
			if (len > 4) {
				return new Date(y, m, d, value[i.index++], value[i.index++], value[i.index++],
					len > 8 ? value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + value[i.index++] * 16777216 : 0);
			} else {
				return new Date(y, m, d);
			}
		case 8: // LONGLONG
			// TODO: JS doesn't support that high numbers => find a workaround, or don't support it.
			i.index += 8;
			return;
		case 9: // INT24/MEDIUMINT
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16);
			return num > 8388607 && (column.flags & 32) === 0 ? num - 16777216 : num;
		case 10: // DATE
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16),
				y = ~~(num / 512),
				m = ~~((num - y * 512) / 32),
				d = num - y * 512 - m * 32;
			return new Date(y, m, d);
		case 11: // TIME
			var len = value[i.index++];
			if (len === 0) return 0;
			var sign = value[i.index++] ? -1 : 1,
				d = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + value[i.index++] * 16777216,
				h = value[i.index++],
				m = value[i.index++],
				s = value[i.index++],
				ms = len > 8 ? value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + value[i.index++] * 16777216 : 0;
			return sign * (h*3600000 + m*60000 + s*1000 + ms);
		case 13: // YEAR
			return value[i.index++]+1901;
		case 14: // NEWDATE
			// TODO: Can't encounter this datatype :(
			return;
		case 15: // VARCHAR
		case 252: // BLOB
		case 253: // VARSTRING
		case 254: // STRING
			return packet.getLCBString(i);
		case 16: // BIT
			return value[i.index++] === 0 ? false : true;
		case 246: // NEWDECIMAL
			return parseFloat(packet.getLCBString(i));
		case 247: // ENUM
			// TODO: The ENUM columntype is apparently 254. => What does this type do? Maybe MySQL 4.1?
			return;
		case 248: // SET
			// TODO: The SET columntype is apparently 254. => What does this type do? Maybe MySQL 4.1?
			return;
		case 249: // TINYBLOB
			return; // MySQL 4.1?
		case 250: // MEDIUMBLOB
			return;
		case 251: // LONGBLOB
			return;
		case 255: // GEOMETRY
			return;
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
		case 0x01:
		case 0x02:
		case 0x03:
		case 0x07:
		case 0x09:
		case 0x0D:
			return parseInt(value);
		case 0x06:
			return null;
		case 0x0B: // TIME
			console.log(value);
			var sign = 1;
			if (value[0] === '-') {
				sign = -1;
				value = value.substring(1);
			}
			var parts = value.split(':');
			return sign * (parts[0]*3600000 + parts[1]*60000 + parts[2]*1000);
		case 0x0A:
		case 0x0C:
		case 0x0E:
			return new Date(value);
		case 0x10:
			return value === '\u0000' ? false : true;
		default:
			return value;
	}
};

/**
 * The row data
 * 
 * @type {Array.<*>}
 */
RowPacket.prototype.data = null;

exports.RowPacket = RowPacket;