function OutgoingPacket() {}

OutgoingPacket.prototype.data = [];

OutgoingPacket.prototype.writeFixedNumber = function(num, bytes) {
	this.data[this.data.length] = num & 255;
	for (var i=0; i < bytes-1; ++i) {
		this.data[this.data.length] = (num >> 8 * Math.pow(2, i)) & 255;
	}
};

OutgoingPacket.prototype.writeLCB = function(num) {
	if (num >= 0 && num < 251) {
		this.data[this.data.length] = num;
	} else if (num === null) {
		this.data[this.data.length] = 251;
	} else {
		if (num > 255 && num < 65536) { // 16bit word
			this.data[this.data.length] = 252;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >> 8) & 255;
		} else if (num > 65535 && num < 16777216) { // 24bit word
			this.data[this.data.length] = 253;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >> 8) & 255;
			this.data[this.data.length] = (num >> 16) & 255;
		} else { // 64bit word
			this.data[this.data.length] = 254;
			this.data[this.data.length] = num & 255;
			this.data[this.data.length] = (num >> 8) & 255;
			this.data[this.data.length] = (num >> 16) & 255;
			this.data[this.data.length] = (num >> 24) & 255;
			this.data[this.data.length] = (num >> 32) & 255;
			this.data[this.data.length] = (num >> 40) & 255;
			this.data[this.data.length] = (num >> 48) & 255;
			this.data[this.data.length] = (num >> 56) & 255;
		}
	}
};


OutgoingPacket.prototype.writeString = function(str) {
	for (var i=0; i < str.length; ++i) {
		this.data[this.data.length] = str.charCodeAt(i);
	}
	this.data[this.data.length] = 0;
};

OutgoingPacket.prototype.getBuffer = function() {
	var arr = [];
	for (var i=0; i < this.data.length; ++i) {
		arr.splice.bind(arr.length-1, 0).apply(this, this.data[i].data);
	}
	return new Buffer(arr);
};
