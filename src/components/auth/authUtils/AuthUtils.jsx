
// original 
import axios from 'axios';

export const checkIfUserExists = async (email) => {
  const response = await axios.get(
    `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/GetEmailId/EVERY-CIRCLE/${email}`
  );
  return response?.data;
};

