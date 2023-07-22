// Import dependencies
import { OpenAI } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { PineconeClient } from '@pinecone-database/pinecone';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

import { QA_PROMPT, CONDENSE_PROMPT } from '../config/prompts.js';

/**
 * Sanitises the input question.
 * @param {string} question - Input question.
 * @return {string} - Sanitised question.
 */
const sanitiseQuestion = (question) => question.trim().replace('\n', ' ');

/**
 * Initialises the pinecone client.
 * @return {Object} - The initialised Pinecone client.
 */
const initPineconeClient = async () => {
  const pinecone = new PineconeClient();
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT,
    apiKey: process.env.PINECONE_API_KEY,
  });
  return pinecone;
};

/**
 * Calls the Conversational Retrieval QA chain.
 * @param {Object} chain - The initialised chain.
 * @param {string} question - The input question.
 * @param {Array} history - The chat history.
 * @return {Object} - The response from the chain.
 */
const callChain = async (chain, question, history) => {
  const response = await chain.call({
    question,
    chat_history: history || [],
  });
  return response;
};

/**
 * Gets LLM response.
 * @param {string} question - The input question.
 * @param {Array} history - The chat history.
 * @return {Object} - The response from LLM.
 */
export const getLLMResponse = async (question, history) => {
  // Sanitise the question
  question = sanitiseQuestion(question);

  // Initialise the pinecone client
  const pinecone = await initPineconeClient();

  // Set Pinecone index name
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  // Set up index
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    {
      pineconeIndex,
      textKey: 'combined',
      namespace: process.env.PINECONE_NAME_SPACE,
    }
  );

  // Initialise the model
  const model = new OpenAI({
    temperature: 0,
    maxTokens: 2000,
    modelName: 'gpt-3.5-turbo-16k',
    cache: true,
  });

  // Set up the chain
  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(5),
    {
      returnSourceDocuments: true,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      qaTemplate: QA_PROMPT,
    }
  );

  // Call the chain and return the response
  return await callChain(chain, question, history);
};
