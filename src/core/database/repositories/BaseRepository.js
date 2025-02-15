import mongoose from 'mongoose';

export class BaseRepository {
  constructor(modelName, schema) {
    this.model = mongoose.model(modelName, schema);
  }

  async find(filter = {}) {
    return this.model.find(filter).lean().exec();
  }

  async findById(id) {
    return this.model.findById(id).lean().exec();
  }

  async create(data) {
    return this.model.create(data);
  }

  async update(id, data) {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id) {
    return this.model.findByIdAndDelete(id).exec();
  }
}
