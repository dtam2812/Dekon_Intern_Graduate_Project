export const toJSONTransform = {
  versionKey: false,
  transform: (doc: any, ret: any) => {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    return ret;
  },
};
