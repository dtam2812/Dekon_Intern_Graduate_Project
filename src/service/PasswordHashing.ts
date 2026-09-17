import * as bcrypt from 'bcrypt';

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt();
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  inputPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, inputPassword);
};
