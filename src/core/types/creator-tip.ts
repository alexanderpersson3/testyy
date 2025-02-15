
export interface CreatorTip {
  _id?: ObjectId;
  userId: ObjectId;
  content: string;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}
