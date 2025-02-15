const jwt = require('jsonwebtoken');

const authenticateWS = (req, socket, head) => {
  return new Promise((resolve, reject) => {
    try {
      const token = req.headers['sec-websocket-protocol']?.split(', ')[1];
      
      if (!token) {
        throw new Error('No token provided');
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          throw new Error('Invalid token');
        }
        
        req.user = {
          id: decoded.userId,
          role: decoded.role
        };
        resolve();
      });
    } catch (error) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      reject(error);
    }
  });
};

module.exports = { authenticateWS };