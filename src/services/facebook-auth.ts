import axios from 'axios';

interface FacebookUser {
  id: string;
  email: string;
  name?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

export async function verifyFacebookToken(token: string): Promise<FacebookUser> {
  try {
    const response = await axios.get('https://graph.facebook.com/me', {
      params: {
        access_token: token,
        fields: 'id,email,name,picture'
      }
    });

    const { data } = response;
    if (!data.email) {
      throw new Error('Email not provided');
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      picture: data.picture
    };
  } catch (error) {
    console.error('Facebook token verification failed:', error);
    throw new Error('Invalid Facebook token');
  }
} 