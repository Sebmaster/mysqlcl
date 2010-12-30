var Buffer = require('buffer').Buffer;

function Packet(buffer) {
	this.length = (buffer[2] << 16) + (buffer[1] << 8) + buffer[0];
	this.nr = buffer[3];
	this.data = buffer.slice(4, buffer.length);
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
 * Gets a string until a null termination.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {string} encoding the encoding of the string
 * @return {string} the null-terminated string (no ending 0x00)
 */
Packet.prototype.getFixedString = function(iw, length, encoding) {
	if (!encoding) encoding = "ascii";
	var buf = new Buffer(length);
	this.data.copy(buf, 0, iw.index);
	iw.index += length;
	return buf.toString(encoding);
};

/**
 * Gets a string until a null termination.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {string} encoding the encoding of the string
 * @return {string} the null-terminated string (no ending 0x00)
 */
Packet.prototype.getNullString = function(iw, encoding) {
	if (!encoding) encoding = "ascii";
	for (var start=iw.index; iw.index < this.data.length; ++iw.index) {
		if (this.data[iw.index] == 0) {
			return this.data.toString(encoding, start, ++iw.index);
		}
	}
	return this.data.toString(encoding, start, iw.index);
};

exports.Packet = Packet;