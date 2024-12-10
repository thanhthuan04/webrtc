const socket = io('https://webrtc-c7na.onrender.com');

$('#btnLogin').click(() => {
    const username = $('#txtUsername').val();
    const password = $('#txtPassword').val();

    if (username == null || username == "") {
        alert('Username không thể bỏ trống!');
        return;
    }

    if (password == null || password == "") {
        alert('Password không thể bỏ trống!');
        return;
    }

    // Gửi yêu cầu đăng nhập
    socket.emit('DANG_NHAP', { username, password });
});

$('#btnSignUp').click(() => {
    const username = $('#txtUsername').val();
    const fullname = $('#txtFullname').val();
    const password = $('#txtPassword').val();
    const repassword = $('#txtRePassword').val();

    if (username == null || username == "") {
        alert('Username không thể bỏ trống!');
        return;
    }

    if (fullname == null || fullname == "") {
        alert('Fullname không thể bỏ trống!');
        return;
    }

    if (password == null || password == "") {
        alert('Password không thể bỏ trống!');
        return;
    }

    if (repassword != password) {
        alert('Xác nhận lại password không khớp');
        return;
    }

    // Gửi yêu cầu đăng ký
    socket.emit('DANG_KY', { username, fullname, password });
});

$('#btnBackSignUp').click(() => {
    window.location.href = 'signup.html';
});

$('#btnBackLogin').click(() => {
    window.location.href = 'index.html';
});

socket.on('DANG_NHAP_THANH_CONG', ({ username, fullname, role }) => {
    // Chuyển hướng đến trang home.html
    window.location.href = `home.html?username=${encodeURIComponent(username)}&fullname=${encodeURIComponent(fullname)}&role=${encodeURIComponent(role)}`;
});

socket.on('DANG_KY_THANH_CONG', message => {
    alert(message);
    // Chuyển hướng đến trang index.html
    window.location.href = 'index.html';
});

socket.on('DANG_NHAP_THAT_BAI', message => alert(message));
socket.on('DANG_KY_THAT_BAI', message => alert(message));
socket.on('DANG_KY_THATBAI', () => alert('Vui lòng chọn username khác!'));

function openStream() {
    const config = { audio: true, video: true };
    return navigator.mediaDevices.getUserMedia(config).then(stream => {
        localStream = stream;  // Lưu stream để có thể bật/tắt sau này
        return stream;
    });
}

// Thêm sự kiện cho nút tắt/mở camera
$('#btnToggleCamera').click(() => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled; // Bật/tắt camera
        $('#btnToggleCamera').text(videoTrack.enabled ? 'Tắt Camera' : 'Mở Camera');
    }
});

// Thêm sự kiện cho nút tắt/mở mic
$('#btnToggleMic').click(() => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled; // Bật/tắt mic
        $('#btnToggleMic').text(audioTrack.enabled ? 'Tắt Mic' : 'Mở Mic');
    }
});

function playStream(idVideoTag, stream) {
    const video = document.getElementById(idVideoTag);
    video.srcObject = stream;
    video.play();
}

const peer = new Peer(); // Tạo một Peer mới
const connectedPeers = new Set(); // Đối tượng lưu trữ các kết nối peer
let localStream; // Biến để lưu luồng video của người dùng

// Khi Peer được kết nối
peer.on('open', id => {
    const roomID = new URLSearchParams(window.location.search).get('roomID');
    console.log('Your peer ID is: ' + id);
    document.getElementById('my-peer').textContent = `ID của tôi: ${id}`;
    socket.emit('join-room', roomID, id, fullname);
});

socket.on('room-users', (users) => {
    users.forEach(user => {
        if (!connectedPeers.has(user.userID)) {
            $('#ulUser').append(`<li id="${user.userID}">${user.fullname}</li>`);
            connectedPeers.add(user.userID);
        }
    });
});

socket.on('user-connected', ({ userID, fullname }) => {
    if (!connectedPeers.has(userID)) {
        $('#ulUser').append(`<li id="${userID}">${fullname}</li>`);
        connectToNewUser(userID, localStream);
        connectedPeers.add(userID);
    }
});

socket.on('user-disconnected', peerID => {
    if (connectedPeers.has(peerID)) {
        const videoWrapper = document.querySelector(`.remote-video-wrapper[data-peer-id="${peerID}"]`);
        if (videoWrapper) {
            videoWrapper.remove(); // Xóa thẻ video khỏi DOM
        }
        $(`#ulUser li#${peerID}`).remove();
        connectedPeers.delete(peerID); // Xóa peerID khỏi danh sách kết nối
    }
});

function connectToNewUser(peerID, stream) {
    const call = peer.call(peerID, stream); // Gọi đến người mới
    call.on('stream', remoteStream => {
        addRemoteStream(peerID, remoteStream); // Thêm video từ người mới
    });
    call.on('close', () => {
        const videoWrapper = document.querySelector(`.remote-video-wrapper[data-peer-id="${peerID}"]`);
        if (videoWrapper) {
            videoWrapper.remove();
        }
        connectedPeers.delete(peerID);
    });
    connectedPeers.add(peerID);
}


// Khi có kết nối đến từ peer khác
peer.on('connection', function(conn) {
    connections[conn.peer] = conn; // Lưu trữ kết nối
    conn.on('data', function(data) {
        console.log('Received', data);
    });
});

// Khi có cuộc gọi đến từ một peer
peer.on('call', call => {
    if (!connectedPeers.has(call.peer)) {
        call.answer(localStream); // Trả lời cuộc gọi với localStream
        call.on('stream', remoteStream => {
            addRemoteStream(call.peer, remoteStream);
        });
        connectedPeers.add(call.peer);
    }
});

// Khi người dùng nhấn nút "Tạo phòng"
$('#btnCreateRoom').click(() => {
    // Tạo room ID (có thể để người dùng tạo ID hoặc tự động)
    const roomID = generateRandomRoomID();
    socket.emit('TAO_PHONG_HOC_MOI', { roomID, username });
    alert(`Room ID: ${roomID}. Share this ID with others to join.`);
});

// Lấy luồng media từ webcam khi người dùng nhấn nút "Tham gia"
$('#btnConnectRoom').click(() => {
    const roomID = document.getElementById('roomID').value;

    if (roomID) {
        socket.emit('KIEM_TRA_PHONG', { roomID });

        // Nhận phản hồi từ server khi mã phòng hợp lệ
        socket.on('PHONG_HOP_LE', ({ roomID }) => {
            // Chuyển hướng đến trang meeting.html và truyền roomID qua URL
            window.location.href = `meeting.html?roomID=${roomID}&fullname=${fullname}`;
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(function(stream) {
                localStream = stream;
                const localVideo = document.getElementById('localStream');
                localVideo.srcObject = localStream;

                const conn = peer.connect(roomID);
                conn.on('open', function() {
                    conn.send(`Người dùng ${fullname} đã tham gia vào phòng: ${roomID}`);
                });

                const call = peer.call(roomID, localStream);
                call.on('stream', function(remoteStream) {
                    addRemoteStream(roomID, remoteStream);
                });
            })
            .catch(function(err) {
                console.log('Failed to get local stream', err);
            });
        });

        // Nhận phản hồi từ server khi mã phòng không hợp lệ
        socket.on('PHONG_KHONG_HOP_LE', () => {
            alert('Mã phòng không tồn tại! Vui lòng kiểm tra lại.');
        });
    } else {
        alert('Vui lòng nhập mã phòng!');
    }
});


// Hàm thêm luồng video từ peer khác vào trang
function addRemoteStream(peerID, stream) {
    const videoContainer = document.getElementById('videoContainer');

    // Kiểm tra xem đã có video với peerID này chưa
    let existingVideoWrapper = document.querySelector(`.remote-video-wrapper[data-peer-id="${peerID}"]`);
    
    if (existingVideoWrapper) {
        // Nếu đã có video, cập nhật lại luồng stream
        const existingVideoElement = existingVideoWrapper.querySelector('video');
        existingVideoElement.srcObject = stream;
    } else {
        // Nếu chưa có, tạo video mới
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.controls = true;
        videoElement.classList.add('remote-video');

        // Tạo div wrapper cho video với class và data-peer-id để theo dõi
        const videoWrapper = document.createElement('div');
        videoWrapper.classList.add('col', 'l-6', 'm-6', 'c-12', 'remote-video-wrapper');
        videoWrapper.setAttribute('data-peer-id', peerID); // Gán data attribute để dễ kiểm tra

        videoWrapper.appendChild(videoElement);
        videoContainer.appendChild(videoWrapper);
    }
}

// Gửi tin nhắn
$('#btnSendMessage').click(() => {
    const message = $('#yourMessage').val().trim();
    if (message) {
        $('#yourMessage').val(''); // Xóa ô nhập sau khi gửi
        $('#messages').append(`YOU: ${message}\n`); // Hiển thị tin nhắn của chính bạn

        // Gửi tin nhắn lên server
        socket.emit('GUI_TIN_NHAN', { roomID, fullname, message });
    } else {
        alert('Tin nhắn không thể bỏ trống!');
    }
});

// Nhận tin nhắn
// Lấy tin nhắn lịch sử khi vào phòng
socket.on('LOAD_TIN_NHAN', (messages) => {
    messages.forEach(({ fullname, message }) => {
        $('#messages').append(`${fullname}: ${message}\n`);
    });
});

// Nhận tin nhắn mới từ server
socket.on('TIN_NHAN_MOI', ({ fullname, message }) => {
    $('#messages').append(`${fullname}: ${message}\n`);
});

// Hàm tạo room ID ngẫu nhiên
function generateRandomRoomID() {
    return Math.random().toString(36).substr(2, 9);
}
