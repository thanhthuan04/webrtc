const { createClient } = require('@supabase/supabase-js');
const io = require('socket.io')(process.env.PORT || 3000, {
    cors: {
        origin: 'https://thanhthuan04.github.io',
        methods: ['GET', 'POST']
    }
});

// Kết nối đến Supabase
const supabaseUrl = "https://kcekqysglkvfnplbfatw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZWtxeXNnbGt2Zm5wbGJmYXR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4MzQ4MTMsImV4cCI6MjA0OTQxMDgxM30.BjpNTbHbE6EvfDEy_NNjgeMPqBjHiUYHVCdcqb8IFqw";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// const arrUserInfo = [];
const messages = {};
const rooms = {};

io.on('connection', socket => {
    
    // Xử lý sự kiện đăng ký
    socket.on('DANG_KY', async ({ username, fullname, password }) => {
        // Kiểm tra người dùng đã tồn tại
        const { data: existingUser, error: checkError } = await supabase
            .from('account')
            .select('*')
            .eq('username', username)
            .single();

        if (existingUser) {
            return socket.emit('DANG_KY_THAT_BAI', 'Username đã tồn tại');
        }

        // Tạo tài khoản mới
        const { error: insertError } = await supabase
            .from('account')
            .insert([{ username, fullname, password}]);

        if (insertError) {
            console.error('Error creating user:', insertError);
            return socket.emit('DANG_KY_THAT_BAI', 'Lỗi khi tạo tài khoản');
        }

        socket.emit('DANG_KY_THANH_CONG', 'Đăng ký thành công');
    });
    
    socket.on('DANG_NHAP', async ({ username, password }) => {
        const { data: user, error } = await supabase
            .from('account')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !user) {
            return socket.emit('DANG_NHAP_THAT_BAI', 'Tên đăng nhập hoặc mật khẩu không đúng');
        }

        socket.emit('DANG_NHAP_THANH_CONG', { username: user.username, fullname: user.fullname, role: user.role });
    });

    socket.on('LAY_DS_PHONG_HOC', async (username) => {
        const { data: rooms, error } = await supabase
            .from('room')
            .select('roomid')
            .eq('username', username);
    
        if (error) {
            console.error('Lỗi khi lấy danh sách phòng học:', error);
            return;
        }
    
        // Gửi danh sách phòng học lại cho client
        socket.emit('DANH_SACH_PHONG_HOC', rooms);
    });

    socket.on('TAO_PHONG_HOC_MOI', async ({ roomID, username }) => {
        const { data, error } = await supabase
            .from('room')
            .insert([
                { roomid: roomID, username: username }
            ]);
    
        if (error) {
            console.error('Lỗi khi tạo phòng học:', error);
            socket.emit('TAO_PHONG_HOC_THAT_BAI', 'Không thể tạo phòng học mới. Vui lòng thử lại.');
        } else {
            socket.emit('TAO_PHONG_HOC_THANH_CONG', { roomID, username });
        }
    });

    socket.on('KIEM_TRA_PHONG', async ({ roomID }) => {
        const { data: room, error } = await supabase
            .from('room')
            .select('*')
            .eq('roomid', roomID)
            .single();
    
        if (room && !error) {
            // Nếu mã phòng tồn tại, gửi phản hồi hợp lệ về client
            socket.emit('PHONG_HOP_LE', { roomID });
        } else {
            // Nếu mã phòng không tồn tại, gửi phản hồi không hợp lệ về client
            socket.emit('PHONG_KHONG_HOP_LE');
        }
    });

    socket.on('GUI_TIN_NHAN', ({ roomID, fullname, message }) => {
        // Lưu tin nhắn vào phòng tương ứng
        if (!messages[roomID]) {
            messages[roomID] = [];
        }
        messages[roomID].push({ fullname, message });
    
        // Phát tin nhắn đến tất cả các user trong phòng
        socket.to(roomID).emit('TIN_NHAN_MOI', { fullname, message });
    });

    socket.on('join-room', (roomID, userID, fullname) => {
        socket.join(roomID);
    
        // Khởi tạo mảng người dùng nếu phòng chưa tồn tại
        if (!rooms[roomID]) {
            rooms[roomID] = [];
        }
    
        // Lưu thông tin người dùng mới vào phòng
        rooms[roomID].push({ userID, fullname });
    
        // Gửi danh sách người dùng hiện tại cho người mới tham gia
        socket.emit('room-users', rooms[roomID]);
    
        // Phát sóng tới tất cả người dùng khác rằng có người mới tham gia
        socket.to(roomID).emit('user-connected', { userID, fullname });

        // Gửi tin nhắn lịch sử cho người dùng mới
        if (messages[roomID]) {
            socket.emit('LOAD_TIN_NHAN', messages[roomID]);
        }
    
        // Xóa người dùng khi ngắt kết nối
        socket.on('disconnect', () => {
            rooms[roomID] = rooms[roomID].filter(user => user.userID !== userID);
            socket.to(roomID).emit('user-disconnected', userID);
    
            // Xóa phòng nếu không còn người dùng
            if (rooms[roomID].length === 0) {
                delete rooms[roomID];
            }
        });
    });
    
});