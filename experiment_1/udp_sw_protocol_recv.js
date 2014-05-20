var dgram = require('dgram');
var dgram_recv = dgram.createSocket('udp4');

var origin = {
  PORT: 3000,
  ADDRESS: 'localhost'
};
// rinfo cached
var target = {};

var input = null,
    buf = null;

var lock = true;

//var ACK = new Buffer(1);
//ACK.writeInt8(1);

process.stdin.setEncoding('utf8');
process.stdin.on('readable', init);

dgram_recv.on('message', function (msg, rinfo) {
  console.log('recived message from ' + rinfo.address + ':' + rinfo.port + '=>' + msg.toString('utf8'));
  console.log('choose a char: a, b, c');
  console.log('a. ACK\nb. NAK\nc. timeout');
  target.ADDRESS = rinfo.address;
  target.PORT = rinfo.port;
  //seq = msg.readInt8(0);    // get seq in segment head
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
  buf = new Buffer(input);
  /* concat an ACK* to buf */
  //buf = Buffer.concat([ACK, buf]);
  Array.prototype.pop.call(buf);
  dgram_recv.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  lock = true;
}