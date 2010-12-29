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
 * Gets a string until a null termination.
 * 
 * @param {{index: number}} iw the start index (wrapper)
 * @param {string} encoding the encoding of the string
 */
Packet.prototype.getFixedNumber = function(iw, bytes) {
	var num = 0;
	for (var start=iw.index, bytes=bytes+iw.index; iw.index < bytes; ++iw.index) {
		num += this.data[iw.index] << (iw.index-start);
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
Packet.prototype.getNullString = function(iw, encoding) {
	if (!encoding) encoding = "utf-8";
	for (var start=iw.index; iw.index < this.data.length; ++iw.index) {
		if (this.data[iw.index] == 0) {
			return this.data.toString(encoding, start, ++iw.index);
		}
	}
	return this.data.toString(encoding, start, iw.index);
};

exports.Packet = Packet;