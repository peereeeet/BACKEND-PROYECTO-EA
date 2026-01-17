import bcrypt from 'bcryptjs';

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOTP = async (otp: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

export const verifyOTP = async (
  inputOtp: string,
  hashedOtp: string,
): Promise<boolean> => {
  return bcrypt.compare(inputOtp, hashedOtp);
};
