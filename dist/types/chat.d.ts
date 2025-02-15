export interface ChatMessage {
    _id?: ObjectId;
    roomId: ObjectId;
    userId: ObjectId;
    content: string;
    createdAt: Date;
}
export interface ChatRoom {
    _id?: ObjectId;
    name: string;
    creatorId: ObjectId;
    participants: ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}
