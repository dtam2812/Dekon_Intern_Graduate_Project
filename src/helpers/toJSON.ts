export const toJSONTransform = {
  versionKey: false,
  transform: (
    _doc: unknown,
    ret: { _id?: { toString(): string }; id?: string } & Record<
      string,
      unknown
    >,
  ) => {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    return ret;
  },
};
