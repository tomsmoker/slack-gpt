// Import dependencies
import * as dotenv from 'dotenv';
import bolt from '@slack/bolt';
import { getLLMResponse } from './lib/getLLMResponse.js';

// Configure dotenv
dotenv.config();

const { App } = bolt;

/**
 * Sends a loading message to the user.
 * @param {Object} client - The Slack client.
 * @param {string} channel - The Slack channel to send the message to.
 * @return {Object} - The response from the Slack API.
 */
const sendLoadingMessage = async (client, channel) => {
  const loadingMessageResponse = await client.chat.postMessage({
    channel,
    text: 'Thinking...',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Processing ...',
        },
      },
    ],
  });
  return loadingMessageResponse;
};

/**
 * Fetches the last 6 messages in the conversation history.
 * @param {Object} client - The Slack client.
 * @param {string} channel - The Slack channel to fetch the messages from.
 * @param {string} timestamp - The timestamp up to which to fetch messages.
 * @param {string} userId - The user ID who sent the current message.
 * @return {Array} - An array of formatted messages.
 */
const fetchHistory = async (client, channel, timestamp, userId) => {
  const historyResult = await client.conversations.history({
    channel,
    latest: timestamp,
    inclusive: false,
    limit: 6,
  });

  const formattedHistory = historyResult.messages
    .map((message) => {
      const messageType = message.user === userId ? 'USER MESSAGE' : 'SYSTEM RESPONSE';
      return `${messageType}:${message.text}`;
    })
    .reverse();

  return formattedHistory;
};

/**
 * Updates the loading message with the response from the LLM.
 * @param {Object} client - The Slack client.
 * @param {string} channel - The Slack channel to update the message in.
 * @param {string} timestamp - The timestamp of the message to update.
 * @param {string} text - The new text for the message.
 */
const updateMessage = async (client, channel, timestamp, text) => {
  await client.chat.update({
    channel,
    ts: timestamp,
    text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      },
    ],
  });
};

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.event('message', async ({ event, client }) => {
  try {
    // Check if the message is from a direct message channel
    if (event.channel_type === 'im' && event.text) {
      const loadingMessageResponse = await sendLoadingMessage(client, event.channel);

      const formattedHistory = await fetchHistory(client, event.channel, event.ts, event.user);

      const response = await getLLMResponse(event.text, formattedHistory);

      await updateMessage(client, event.channel, loadingMessageResponse.ts, response.text);
    }
  } catch (error) {
    console.error(error);
  }
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();
