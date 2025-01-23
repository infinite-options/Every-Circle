import axios from 'axios';

export const checkIfUserExists = async (email) => {
  const response = await axios.get(
    `https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/GetEmailId/EVERY-CIRCLE/${email}`
  );
  return response?.data;
};

export const checkIfProfileExists = async (userId) => {
    console.log('inside check profile', userId)
    const response = await axios.get(`https://ioec2testsspm.infiniteoptions.com/profile/${userId}`);
    console.log('resp from prof', response)
    return response?.data;
  };

export const checkIfPasswordCorrect = async(password) => {

}

// export const handleUserSignUp = async (formData) => {
//     try {
//       const userExists = await checkIfUserExists(formData.email);
//       console.log('userExists', userExists);
//       if (userExists?.message !== "User EmailID doesnt exist") {
//         //check if profile exists
//         // return { success: false, message: "Email already exists" };
//         const userId = userExists.result;
//         try{
//             const profileResponse = await checkIfProfileExists(userId);
//             console.log('profileResp', profileResponse);
//         } catch(error) {
//             console.log(error.response.data.message);
//         }
        
//       }
  
//       // Make the signup API call
//       const response = await axios.post(
//         'https://mrle52rri4.execute-api.us-west-1.amazonaws.com/dev/api/v2/signup',
//         formData
//       );
  
//       return { success: true, data: response.data };
//     } catch (error) {
//       return { 
//         success: false, 
//         message: error.response?.data?.message || "An error occurred during signup" 
//       };
//     }
//   };