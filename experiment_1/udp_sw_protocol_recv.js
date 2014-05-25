var dgram = require('dgram');
var dgram_recv = dgram.createSocket('udp4');

var origin = {
  PORT: process.argv[2] || 3000,
  ADDRESS: 'localhost'
};
// rinfo cached
var target = {};

var lock = true;

var ack_seq = 0;

dgram_recv.on('message', function (msg, rinfo) {
  var seqnum = msg.readUInt8(0);
  msg = msg.slice(1).toString('utf8');
  target.ADDRESS = rinfo.address;
  target.PORT = rinfo.port;
  if (ack_seq == seqnum) {
    ack_seq = (seqnum + 1) % 2;
    console.log(msg);
  }
  var buf_ack_seq = new Buffer(1);
  buf_ack_seq.writeUInt8((ack_seq + 1) % 2, 0);
  // random send broken ack
  var rd = random();
  if (rd == 'ok') {
    buf_ack_seq.writeUInt8(ack_seq, 0);
    dgram_recv.send(buf_ack_seq, 0, buf_ack_seq.length, target.PORT, target.ADDRESS);
  } 
  if (rd == 'broken'){
    buf_ack_seq.writeUInt8((ack_seq + 1) % 2, 0);
    dgram_recv.send(buf_ack_seq, 0, buf_ack_seq.length, target.PORT, target.ADDRESS);
  }
  // else means timeout
});

dgram_recv.on('listening', function () {
  var address = dgram_recv.address();
  console.log('reciver is listening on ', address.address + ':' + address.port);
});

// block the process to recive the datagram
dgram_recv.bind(origin.PORT);

// packet loss 50%
function random() {
  var num = parseInt(Math.random() * 10);
  if (num < 5) return 'timeout';
  if (num < 8) return 'ok';
  return 'broken';
}