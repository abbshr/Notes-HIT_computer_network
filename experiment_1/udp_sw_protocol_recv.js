var dgram = require('dgram');
var dgram_recv = dgram.createSocket('udp4');

var origin = {
  PORT: process.argv[2] || 3000,
  ADDRESS: 'localhost'
};
// rinfo cached
var target = {};

var input = null,
    buf = null;

var lock = true;

var ack_seq = 0;
//var ACK = new Buffer(1);
//ACK.writeInt8(1);

process.stdin.setEncoding('utf8');
process.stdin.on('readable', init);

dgram_recv.on('message', function (msg, rinfo) {
  var seqnum = msg.readUInt8(0);
  msg = msg.slice(1).toString('utf8');
  ack_seq = (seqnum + 1) % 2;
  console.log('recived message from ', rinfo.address, ':', rinfo.port)
  console.log('packet data:', msg, ', seqnum:', seqnum);
  console.log('you expect next recive seqnum:', ack_seq);
  console.log('choose a char: a, b, c');
  console.log('a. ACK\nb. NAK\nc. timeout');
  console.log('input format: signal ack_seq');
  console.log('e.x.: a 0');
  target.ADDRESS = rinfo.address;
  target.PORT = rinfo.port;
  lock = false;
  process.stdin.resume();
});

dgram_recv.on('listening', function () {
  var address = dgram_recv.address();
  console.log('reciver is listening on ', address.address + ':' + address.port);
});

// block the process to recive the datagram
dgram_recv.bind(origin.PORT);

function init() {
  if (lock) return process.stdin.pause();
  input = process.stdin.read();
  if (!input) return;
  input = input.split(/[\s|\t]+/);
  // get input, 'a' or 'b' or 'c'
  var signal = new Buffer(input[0]);
  // get ack_seq
  var buf_ack_seq = new Buffer(1);
  buf_ack_seq.writeUInt8(Number(input[1]) || ' ', 0);
  buf = Buffer.concat([buf_ack_seq, signal]);
  dgram_recv.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  lock = true;
}