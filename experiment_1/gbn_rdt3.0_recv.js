var dgram = require('dgram');

var dgram_recv = dgram.createSocket('udp4');

var origin = {
  PORT: process.argv[2] || 3000,
  ADDRESS: 'localhost'
};

// rinfo cached
var target = {};
// standard input stream
var input = null,
    buf = null;

//var lock = true;

// seqnum that I expect to recive
var expectedseqnum = 0;

process.stdin.setEncoding('utf8');
process.stdin.on('readable', handle_input_db);

dgram_recv.on('message', function (msg, rinfo) {
  // get seqnum
  var seqnum = msg.readUInt8(0);
  // update the expect seqnum
  expectedseqnum = seqnum + 1;
  // get data packet
  msg = msg.slice(1);
  console.log('recived message from ', rinfo.address, ':', rinfo.port);
  console.log('you expect seqnum is ', expectedseqnum);
  console.log('seqnum: ', seqnum, ', packet data: ', msg.toString('utf8'));            
  console.log('choose a char to request: a or others');
  console.log('a. ACK\nothers. timeout');
  console.log('input format: signal ack_seq');
  console.log('e.g.: "a 5"');
  target.ADDRESS = rinfo.address;
  target.PORT = rinfo.port;
  //lock = false;
  process.stdin.resume();
});

dgram_recv.on('listening', function () {
  var address = dgram_recv.address();
  console.log('reciver is listening on ', address.address , ':',  address.port);
});

// block the process to recive the datagram
dgram_recv.bind(origin.PORT);

function handle_input_db() {
  //if (lock) return process.stdin.pause();
  input = process.stdin.read();
  if (!input) return;
  input = input.split(/[\s|\t]+/);
  // get input, 'a' or 'c'
  var signal = new Buffer(input[0]);
  // get ack_seq
  var ack_seq = new Buffer(1);
  ack_seq.writeUInt8(Number(input[1]) || ' ', 0);
  // concat together
  buf = Buffer.concat([ack_seq, signal]);
  dgram_recv.send(buf, 0, buf.length, target.PORT, target.ADDRESS);
  //lock = true;
}