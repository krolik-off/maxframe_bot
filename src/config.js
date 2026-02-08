import 'dotenv/config';

export default {
    bot: {
        token: process.env.BOT_TOKEN
    },
    maxframe: {
        apiUrl: process.env.MAXFRAME_API_URL || 'https://maxframe.ru/api/bot/channel-profile/',
        secretKey: process.env.MAXFRAME_SECRET_KEY
    },
    image: {
        width: 1800
    }
};
