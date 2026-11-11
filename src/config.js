import 'dotenv/config';

export default {
    bot: {
        token: process.env.BOT_TOKEN
    },
    maxframe: {
        apiUrl: process.env.MAXFRAME_API_URL || 'https://maxframe.ru/api/bot/channel-profile/',
        membershipUrl: process.env.MAXFRAME_MEMBERSHIP_URL || 'https://maxframe.ru/api/bot/channel-membership/',
        secretKey: process.env.MAXFRAME_SECRET_KEY
    },
    webhook: {
        url: process.env.WEBHOOK_URL
    },
    api: {
        secretKey: process.env.API_SECRET_KEY
    },
    image: {
        width: 1800
    }
};
