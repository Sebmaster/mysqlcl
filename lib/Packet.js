var Buffer = require("buffer").Buffer;

/**
 * A packet of the MySQL server
 * 
 * @constructor
 * @param {Buffer} the sent buffer
 */
function Packet(buffer) {
	this.length = (buffer[2] << 16) + (buffer[1] << 8) + buffer[0];
	this.nr = buffer[3];
	this.data = buffer.slice(4, this.length+4);
}

/**
 * The length of the data part of the packet
 * 
 * @type {number}
 */
Packet.prototype.length = null;

/**
 * The number of the packet
 * 
 * @type {number}
 */
Packet.prototype.nr = null;

/**
 * The data of the packet
 * 
 * @type {Buffer}
 */
Packet.prototype.data = null;

/**
 * Reads a number of a fixed length.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {number} bytes the bytes to read
 * @return {number} the read number
 */
Packet.prototype.getFixedNumber = function(iw, bytes) {
	var num = 0;
	--bytes;
	for (var i=0; i <= bytes; ++i, ++iw.index) {
		num += this.data[iw.index] << (8*(Math.pow(2, i)-1));
	}
	return num;
};

/**
 * Reads a length coded binary number.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @return {number} the read number
 */
Packet.prototype.getLCBNumber = function(iw) {
	if (this.data[iw.index] >= 0 && this.data[iw.index] <= 250) { // the actual value
		return this.data[iw.index++];
	} else if (this.data[iw.index] === 251) { // null
		++iw.index;
		return null;
	} else if (this.data[iw.index] === 252) { // 2 byte (16bit)
		return this.data[iw.index++] + (this.data[iw.index++] << 8);
	} else if (this.data[iw.index] === 253) { // 3 byte (24bit)
		return this.data[iw.index++] + (this.data[iw.index++] << 8) + (this.data[iw.index++] << 16);
	} else if (this.data[iw.index] === 254) { // 8 byte (64bit)
		return this.data[iw.index++] + (this.data[iw.index++] << 8) + (this.data[iw.index++] << 16) + (this.data[iw.index++] << 24) + (this.data[iw.index++] << 32) + (this.data[iw.index++] << 40) + (this.data[iw.index++] << 48) + (this.data[iw.index++] << 56);
	}
};

/**
 * Gets a string until a null termination.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {?string} encoding the encoding of the string
 * @return {string} the null-terminated string (no ending 0x00)
 */
Packet.prototype.getFixedString = function(iw, length, encoding) {
	if (!encoding) encoding = "utf8";
	var buf = new Buffer(length);
	this.data.copy(buf, 0, iw.index);
	iw.index += length;
	return buf.toString(encoding);
};

/**
 * Gets a string until a null termination.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {?string} encoding the encoding of the string
 * @return {string} the null-terminated string (no ending 0x00)
 */
Packet.prototype.getNullString = function(iw, encoding) {
	if (!encoding) encoding = "utf8";
	for (var start=iw.index; iw.index < this.data.length; ++iw.index) {
		if (this.data[iw.index] == 0) {
			return this.data.toString(encoding, start, iw.index++);
		}
	}
	return this.data.toString(encoding, start, iw.index);
};


/**
 * Gets a length-coded-binary string.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {?string} encoding the encoding of the string
 * @return {string} the string
 */
Packet.prototype.getLCBString = function(iw, encoding) {
	if (!encoding) encoding = "utf8";
	var len = this.getLCBNumber(iw);
	if (len === null) return null;
	var i = iw.index;
	iw.index += len;
	return this.data.toString(encoding, i, iw.index);
};

exports.Packet = Packet;