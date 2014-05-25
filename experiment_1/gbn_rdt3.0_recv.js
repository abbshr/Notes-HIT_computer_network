var dgram = require('dgram');

var dgram_recv = dgram.createSocket('udp4');

var origin = {
  PORT: process.argv[2] || 3000,
  ADDRESS: 'localhost'
};

// rinfo cached
var target = {};

var k = 8;

// seqnum that I expect to recive
var expectedseqnum = 0;
// last time recived
var lastRecived = 0;
// sign, got the first packet
var fir_seq_got = false;

dgram_recv.on('message', function (msg, rinfo) {
  // get seqnum
  var seqnum = msg.readUInt8(0);
  // get data packet
  msg = msg.slice(1).toString();
  target.ADDRESS = rinfo.address;
  target.PORT = rinfo.port;
  // response packet
  var buf_ack_seq = new Buffer(1);
  // fill first byte with 'a' signal
  //buf.utf8Write('a', 0);

  // if get expect seqnum
  if (expectedseqnum == seqnum) {
    // update the expect seqnum
    expectedseqnum = (seqnum + 1) % (2 << (k - 1));
    // update the last recived
    lastRecived = seqnum;
    // fill a byte with ack_seq
    buf_ack_seq.writeUInt8(seqnum, 0);
    console.log('reciver: recived packet:', msg, ', seqnum: ', seqnum);
    console.log('reciver: waiting for next seqnum is:', expectedseqnum);
    // get the first packet
    if (!fir_seq_got && !seqnum) fir_seq_got = true;
  } else {
    // if the first packet isnt in order, dont response
    if (!fir_seq_got) return;
    buf_ack_seq.writeUInt8(lastRecived, 0);
  }

  // start the random sender
  var rd = random();
  if (rd == 'SEND_ORIGIN_MSG')
    dgram_recv.send(buf_ack_seq, 0, buf_ack_seq.length, target.PORT, target.ADDRESS);
  if (rd == 'SEND_GEN_MSG'){
    buf_ack_seq.writeUInt8(255, 0);
    dgram_recv.send(buf_ack_seq, 0, buf_ack_seq.length, target.PORT, target.ADDRESS);
  } 

});

dgram_recv.on('listening', function () {
  var address = dgram_recv.address();
  console.log('reciver is listening on ', address.address , ':',  address.port);
});

// block the process to recive the datagram
dgram_recv.bind(origin.PORT);

/* random send tool, control sending
*  40% timeout
*  40% send the origin ack
*  20% send the incorrect ack
*/
function random() {
  var num = parseInt(Math.random() * 10);
  if (num < 4) return 'SEND_ORIGIN_MSG';
  if (num < 8) return 'TIMEOUT_NOT_SEND';
  return 'SEND_GEN_MSG';
}