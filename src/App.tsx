import React, { useEffect, useState, useRef } from 'react';
import { SocketMessageTypes, SocketEventHandler, TelepartyClient } from '../teleparty-websocket-lib/src/index';
import { Send, UserCircle2, Image as ImageIcon } from 'lucide-react';
import { SocketMessage } from '../teleparty-websocket-lib/src/SocketMessage';

interface Message {
  sender: string;
  body: string;
  timestamp: number;
  userIcon?: string;
}

interface User {
  userName: string;
  userId: string;
}

export const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [userIcon, setUserIcon] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [usersList, setUsersList] = useState<User[]>([]);
  const clientRef = useRef<TelepartyClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnect = async () => {
    if (!nickname) return;

    const eventHandler: SocketEventHandler = {
      onConnectionReady: () => {
        setIsConnected(true);
        console.log("Connection established");
      },
      onClose: () => {
        setIsConnected(false);
        console.log("Connection closed");
      },
      onMessage: (message: SocketMessage) => {
        if (message.type === SocketMessageTypes.SEND_MESSAGE) {
          setMessages(prev => [...prev, {
            sender: message.data.userNickname,
            body: message.data.body,
            timestamp: Date.now(),
            userIcon: message.data.userIcon
          }]);
        } else if (message.type === SocketMessageTypes.SET_TYPING_PRESENCE) {
          setTypingUsers(prev => {
            if (message.data.usersTyping) {
              return message.data.usersTyping;
            } else {
              return prev.filter(user => user !== message.data.usersTyping[0]);
            }
          });
        } else if (message.type === 'userList') {
          setUsersList(message.data.map((user: any) => {
            return {
              userId: user.socketConnectionId,
              userName: user.userSettings.userNickname
            }
          }))
        } else if (message.type === 'userId') {
          setUserId(message.data.userId);
        }
      }
    };

    const client = await new TelepartyClient(eventHandler);
    clientRef.current = client;
    
    setTimeout(async () => {
      if (!roomId) {
        const newRoomId = await client.createChatRoom(nickname, userIcon || "default");
        setRoomId(newRoomId);
      } else {
        const sessionData = await client.joinChatRoom(nickname, roomId, userIcon || "default");
        const formattedMessages: Message[] = sessionData.messages.map((message: any) => {
          return {
            sender: message.userNickname,
            body: message.body,
            timestamp: message.timestamp,
            userIcon: message.userIcon
          }
        })
        setMessages(formattedMessages);
      }
    }, 2000);
  };

  const handleSend = () => {
    if (!inputMessage.trim() || !clientRef.current) return;

    clientRef.current.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
      body: inputMessage,
      userIcon: userIcon
    });
    setInputMessage('');
    setIsTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    
    if (!isTyping && clientRef.current) {
      setIsTyping(true);
      clientRef.current.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
        typing: true
      });
    }
  };

  useEffect(() => {
    let typingTimeout = undefined;

    if (isTyping) {
      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        clientRef.current?.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
          typing: false
        });
      }, 1000);
    }

    return () => clearTimeout(typingTimeout);
  }, [inputMessage, isTyping]);


  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Join Chat</h1>
          <div className="space-y-4">
            <div>
              <div className="flex">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nickname
                </label>
                <label className='text-red-500'>*</label>
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your nickname"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Icon
              </label>
              <div className="flex items-center space-x-2">
                {userIcon ? (
                  <img
                    src={userIcon}
                    alt="User icon"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="w-10 h-10 text-gray-400" />
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center space-x-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Choose Icon</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconSelect}
                  className="hidden"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room ID (optional)
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter room ID to join existing room"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={!nickname}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {roomId ? 'Join Room' : 'Create Room'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {userIcon ? (
                <img
                  src={userIcon}
                  alt="User icon"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <UserCircle2 className="w-6 h-6" />
              )}
              <span className="font-medium">{nickname}</span>
            </div>
            <div className="text-sm text-gray-500">
              Room ID: {roomId}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-1 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === nickname ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.sender === nickname
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  {message.sender !== nickname && (
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                      
                        <UserCircle2 className="w-4 h-4" />
                      
                      <span>{message.sender}</span>
                    </div>
                  )}
                  <div>{message.body}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-4 bg-white rounded-lg shadow-md p-4">
        {typingUsers.length > 0 && typingUsers[0] !== userId && (
            <div className="text-sm text-gray-500 mb-2">
              { usersList.find((user) => user.userId === typingUsers[0])?.userName} is typing...
            </div>
          )}
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
