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
			break;
		case 1: //TINY
			if (value[i.index] > 127 && (column.flags & 32) === 0) {
				return value[i.index++] - 256;
			} else {
				return value[i.index++];
			}
		case 2: // SHORT
			var num = value[i.index++] + (value[i.index++] << 8);
			if (num > 32767 && (column.flags & 32) === 0) {
				return num - 65536;
			} else {
				return num;
			}
		case 3: // LONG
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + (value[i.index++] << 24);
			if (num > 2147483647 && (column.flags & 32) === 0) {
				return num - 4294967295;
			} else {
				return num;
			}
		case 4: // FLOAT
			var data = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + (value[i.index++] * 16777216),
				sign = data & 2147483648 ? -1 : 1,
				exponent = (data & 2139095040) / 8388608,
				number = (data & 8388607) + 8388608;
			if (exponent === 0x00 && number === 8388608) {
				return 0;
			} else if (exponent === 0x00) {
				exponent = 1;
			} else if (exponent === 0xFF && number === 8388608) {
				return sign * Infinity;
			} else if (exponent === 0xFF) {
				return NaN;
			}
			return number * sign * Math.pow(2, exponent-150);
		case 5: // DOUBLE
			// TODO: JS doesn't support that high numbers => find a workaround, or don't support it.
			i.index += 8;
			break;
		case 6: // NULL
			return null;
		case 7: // TIMESTAMP
			return value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16) + (value[i.index++] << 24);
		case 8: // LONGLONG
			// TODO: JS doesn't support that high numbers => find a workaround, or don't support it.
			i.index += 8;
			break;
		case 9: // INT24/MEDIUMINT
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16);
			if (num > 8388607 && (column.flags & 32) === 0) {
				return num - 16777216;
			} else {
				return num;
			}
		case 10: // DATE
			var num = value[i.index++] + (value[i.index++] << 8) + (value[i.index++] << 16),
				y = ~~(num / 512),
				m = ~~((num - y * 512) / 32),
				d = num - y * 512 - m * 32;
			return new Date(y + "-" + m + "-" + d);
		case 11: // TIME
			//FIXME Wrong decoding
			var len = value[i.index++];
			i.index += len;
			break;
		case 12: // DATETIME
			i.index += 8;
			break;
		case 13: // YEAR
			return value[i.index++]+1901;
		case 14: // NEWDATE
			// TODO: Can't encounter this datatype :(
			break;
		case 15: // VARCHAR
		case 253: // VARSTRING
			return packet.getLCBString(i);
		case 16: // BIT
			return value[i.index++] === 0 ? false : true;
		case 246: // NEWDECIMAL
			return parseFloat(packet.getLCBString(i));
		case 247: // ENUM
			// TODO: The ENUM columntype is apparently 254. => What does this type do? Maybe MySQL 4.1?
			break;
		case 248: // SET
			// TODO: The SET columntype is apparently 254. => What does this type do? Maybe MySQL 4.1?
			break;
		case 249: // TINYBLOB
			var len = value[i.index++];
			return value.slice(i.index, i.index += len);
		case 250: // MEDIUMBLOB
			break;
		case 251: // LONGBLOB
			break;
		case 252: // BLOB
			if (column.length === 255) {
				var len = value[i.index++];
				return value.slice(i.index, i.index += len);
			} else if (column.length === 765) {
				var len = value[i.index++];
				return value.slice(i.index, i.index += len).toString('utf8');
			}
		case 254: // STRING
			// TODO: x bytes are the length. How long is x?
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
		case 0xF6:
			return parseFloat(value);
			break;
		case 0x01:
		case 0x02:
		case 0x03:
		case 0x07:
		case 0x09:
		case 0x0D:
			return parseInt(value);
			break;
		case 0x06:
			return null;
			break;
		case 0x0B: // TIME
			var parts = value.split(' '),
				date = new Date('70 ' + parts[1]);
			date.setDate(parts[0]);
			return date;
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