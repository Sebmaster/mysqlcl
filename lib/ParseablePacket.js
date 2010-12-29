var inherits = require('util').inherits,
	Packet = require('./Packet').Packet;

function ParseablePacket(buffer) {
	ParseablePacket.super_.call(this, buffer);
}

inherits(ParseablePacket, Packet);



exports.ParseablePacket = ParseablePacket;