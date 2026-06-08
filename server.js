const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let hasBombIndex = 0;
let timerInterval = null;

io.on('connection', (socket) => {
    console.log('플레이어 접속:', socket.id);
    players.push(socket.id);

    // 전체 플레이어 수 업데이트
    io.emit('updatePlayers', players.length);

    // 디스플레이 화면에서 '게임 시작' 버튼을 눌렀을 때
    socket.on('startGame', () => {
        let timeLeft = 30; // 전체 30초
        
        // 첫 번째 사람에게 폭탄 지급 (0번은 디스플레이 기기라고 가정, 1번부터 플레이어)
        if (players.length > 1) {
            hasBombIndex = 1;
            io.to(players[hasBombIndex]).emit('receiveBomb');
        } else if (players.length === 1) {
            // 1명만 접속해서 테스트할 때를 위한 예외 처리
            hasBombIndex = 0;
            io.to(players[hasBombIndex]).emit('receiveBomb');
        }

        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            io.emit('timerUpdate', timeLeft); // 모든 기기에 남은 시간 전송

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                io.emit('explode'); // 폭탄 폭발 이벤트!
            }
        }, 1000);
    });

    socket.on('throwBomb', () => {
        const currentIndex = players.indexOf(socket.id);
        if (currentIndex !== -1 && players.length > 0) {
            hasBombIndex = (currentIndex + 1) % players.length;
            // 만약 다음 사람이 디스플레이(0번)라면 한 번 더 건너뜀 (플레이어가 여러 명일 때)
            if (hasBombIndex === 0 && players.length > 1) {
                hasBombIndex = 1;
            }
            io.to(players[hasBombIndex]).emit('receiveBomb');
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(id => id !== socket.id);
        console.log('플레이어 퇴장:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중입니다.`);
});
