const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 8081;
const cache = new NodeCache();

// Store active WebSocket connections
const clients = new Map();
const matchSubscriptions = new Map(); // Track which clients are subscribed to which matches

app.use(cors());
app.use(express.json());

// ✅ Rotate through tokens
const AUTH_TOKENS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiQzEwMTAxMDJNMDkiLCJ0b2tlbklkIjoiMjA4MTlhYTJhYTY3NWI1NjI0ZGNiYmViMzQ1ODRkYzYyOTVkODJiM2EwYjAxZmRmNDJhN2FiMWY3ODJiYjQ0MSIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiYmUyMTM4Zjk0MjQ5OWU2NDg2MjkwYTgyYmY3OTUzZDRiZWJlMTQ4NjU4NDU3N2ViMWI5ODhmZTI1NDRkNmY5NCIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0MzA2ODcyMjU1OCwibmJmIjoxNzQzMDY4NzI3LCJsb2dpbk5hbWUiOiJkaXMuZGVtb2Q4IiwibG9naW5JUCI6IjE1Mi41OC4yNDQuMjQ2IiwidGhlbWUiOiJsb3R1cyIsImV4cCI6MTc0MzQxNDMyNywiaWF0IjoxNzQzMDY4NzI3LCJtZW1iZXJJZCI6NTEzNzEwLCJ1cGxpbmVzIjp7IkNPWSI6eyJ1c2VySWQiOjEsInVzZXJDb2RlIjoiYWRtaW4udXNlciJ9LCJTTUEiOnsidXNlcklkIjo1MTMyOTcsInVzZXJDb2RlIjoiQzEwMSJ9LCJNQSI6eyJ1c2VySWQiOjUxMzY5MSwidXNlckNvZGUiOiJDMTAxMDEifSwiQWdlbnQiOnsidXNlcklkIjo1MTM2OTQsInVzZXJDb2RlIjoiQzEwMTAxMDIifX0sImN1cnJlbmN5IjoiSU5SIiwiaXNEZW1vIjp0cnVlLCJtYSI6bnVsbCwiYiI6bnVsbCwicyI6bnVsbCwiYyI6bnVsbH0.GtHiTkROKQb9xgn3BGiZ7bLbY0bATzov-dWV2jfP64Q',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiSTRfLTAxMDFNNFAiLCJ0b2tlbklkIjoiYjg1M2FkMTAyODE4YTk5N2M1YWZhMjBlOTZjNWQ3NzBiMzQwMDg1YWNlMTQ2ZThjNzdmYmI3ZGU5OGUxYWI0NCIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiNWU0ZTM0MWY5ZmZlYWQzMzIwMWI3OTJiMThiNDkxOTE3MzdmYTZkOWNkNWFhNjA0MGFkOGZjODA2NjQ5NmE2YyIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0MjgzNTk1NTAxNSwibmJmIjoxNzQyODQyNDYwLCJsb2dpbk5hbWUiOiJkaXMubWFoZXNoODUyIiwibG9naW5JUCI6IjE1Mi41OC4xOTIuNCIsInRoZW1lIjoibG90dXMiLCJleHAiOjE3NDMxODgwNjAsImlhdCI6MTc0Mjg0MjQ2MCwibWVtYmVySWQiOjkwODUzMDIsInVwbGluZXMiOnsiQ09ZIjp7InVzZXJJZCI6MSwidXNlckNvZGUiOiJhZG1pbi51c2VyIn0sIlNNQSI6eyJ1c2VySWQiOjAsInVzZXJDb2RlIjpudWxsfSwiTUEiOnsidXNlcklkIjo2NTcxOTUsInVzZXJDb2RlIjoiSTRfLTAxIn0sIkFnZW50Ijp7InVzZXJJZCI6NjU3MjAxLCJ1c2VyQ29kZSI6Ikk0Xy0wMTAxIn19LCJjdXJyZW5jeSI6IklOUiIsImlzRGVtbyI6ZmFsc2UsIm1hIjpudWxsLCJiIjpudWxsLCJzIjpudWxsLCJjIjpudWxsfQ.oAEhUVj0-t3kVTG4ggOj4Dueg02wd-kKxx5Z2_joYhU',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiSTRfLTAxMDFNNE4iLCJ0b2tlbklkIjoiMzgwM2U0NjlkMjhkMTcxMjMyZDgwMTE1YmUwZjU2YmExMzAwN2Y2ZmM4NjVlZjcxN2M0YWE3MjhkNWE5YjRlOSIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiZWVkMmQ2YzBlODdhMmFmNjE0MmU1NmZkYTQzNmNkMWE4NzhjZjU3MGQ2MzhmNWMwNGFhODg4ZmU5YWMxZDY5OCIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0Mjg0NDU2NjkyOSwibmJmIjoxNzQyODQ0NTczLCJsb2dpbk5hbWUiOiJkaXMuaGFyaXNoNDYiLCJsb2dpbklQIjoiMTUyLjU4LjE5Mi40IiwidGhlbWUiOiJsb3R1cyIsImV4cCI6MTc0MzE5MDE3MywiaWF0IjoxNzQyODQ0NTczLCJtZW1iZXJJZCI6OTA4NDc2NiwidXBsaW5lcyI6eyJDT1kiOnsidXNlcklkIjoxLCJ1c2VyQ29kZSI6ImFkbWluLnVzZXIifSwiU01BIjp7InVzZXJJZCI6MCwidXNlckNvZGUiOm51bGx9LCJNQSI6eyJ1c2VySWQiOjY1NzE5NSwidXNlckNvZGUiOiJJNF8tMDEifSwiQWdlbnQiOnsidXNlcklkIjo2NTcyMDEsInVzZXJDb2RlIjoiSTRfLTAxMDEifX0sImN1cnJlbmN5IjoiSU5SIiwiaXNEZW1vIjpmYWxzZSwibWEiOm51bGwsImIiOm51bGwsInMiOm51bGwsImMiOm51bGx9.au7E_2eWXM68d-4OPLpBUj5XLebGeBT7DxjyVCwbphw'
];

// User credentials for token renewal
const USER_CREDENTIALS = [
  { username: 'harish46', password: 'GK@789xe' },
  { username: 'mahesh852', password: 'PK@672km' },
  { username: 'ganesh658', password: 'FX@772cw' }
];

let tokenIndex = 0;

const getNextToken = () => {
  const token = AUTH_TOKENS[tokenIndex];
  tokenIndex = (tokenIndex + 1) % AUTH_TOKENS.length;
  return token;
};

// Updated headers with more browser-like behavior
const getRequestHeaders = (token) => ({
  'Authorization': token,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://gobook9.com',
  'Referer': 'https://gobook9.com/sports/4',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
});

// Updated login headers
const getLoginHeaders = () => ({
  ...getRequestHeaders(),
  'Content-Type': 'application/json',
  'Referer': 'https://gobook9.com/login',
  'Origin': 'https://gobook9.com'
});

// Updated renewToken function with enhanced error handling and retry logic
const renewToken = async (credentials, attempt = 1) => {
  try {
    console.log(`🔑 Attempting to renew token for ${credentials.username} (attempt ${attempt})...`);
    
    // Add a random delay between 1-3 seconds before making the request
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const response = await axios.post('https://gobook9.com/api/auth/b2b/login', {
      username: credentials.username,
      password: credentials.password
    }, {
      headers: getLoginHeaders(),
      timeout: 10000
    });
    
    if (response.headers['authorization']) {
      console.log(`✅ Successfully obtained token from response headers for ${credentials.username}`);
      return response.headers['authorization'];
    }
    
    if (response.data?.result?.token) {
      console.log(`✅ Successfully obtained token from response body for ${credentials.username}`);
      return response.data.result.token;
    }
    
    throw new Error('No token found in response');
  } catch (error) {
    console.error(`❌ Error renewing token for ${credentials.username}:`, error.message);
    
    // If we get a VPN error and haven't exceeded max attempts, retry with delay
    if (error.response?.data?.error?.includes('VPN') && attempt < 3) {
      const retryDelay = Math.floor(Math.random() * 5000) + 5000; // 5-10 second delay
      console.log(`⏳ Waiting ${retryDelay/1000} seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return renewToken(credentials, attempt + 1);
    }
    
    return null;
  }
};

// Token manager
class TokenManager {
  constructor(initialTokens, credentials) {
    this.tokens = [...initialTokens];
    this.credentials = credentials;
    this.currentIndex = 0;
    this.renewalAttempts = {};
    this.lastRenewalTime = Date.now();
    this.renewalInProgress = false;
    
    // Start token renewal process
    this.initialRenewal();
  }
  
  async initialRenewal() {
    if (this.renewalInProgress) return;
    this.renewalInProgress = true;
    
    try {
      console.log('🚀 Performing initial token renewal...');
      await this.renewAllTokens();
    } finally {
      this.renewalInProgress = false;
    }
    
    // Schedule regular renewals
    this.scheduleTokenRenewals();
  }
  
  async renewAllTokens() {
    console.log('🔄 Starting token renewal process...');
    
    // Add a delay between each token renewal
    for (let i = 0; i < this.credentials.length; i++) {
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const newToken = await renewToken(this.credentials[i]);
      if (newToken) {
        this.replaceToken(i, newToken);
        this.renewalAttempts[i] = 0;
      }
    }
    
    // Schedule next renewal if all tokens failed
    if (!this.tokens.some(token => token)) {
      console.log('⚠️ All token renewals failed. Scheduling retry...');
      setTimeout(() => this.renewAllTokens(), 5 * 60 * 1000);
    }
  }
  
  // Get next available token
  getToken() {
    const token = this.tokens[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    
    // Check if token needs renewal - auto-check every 10 requests
    if (this.currentIndex % 10 === 0) {
      this.checkRenewalNeeded();
    }
    
    return token;
  }
  
  // Check if renewals are needed based on time
  checkRenewalNeeded() {
    const now = Date.now();
    const hoursSinceLastRenewal = (now - this.lastRenewalTime) / (1000 * 60 * 60);
    
    // If more than 1 hour since last renewal, renew all tokens
    if (hoursSinceLastRenewal > 1) {
      console.log(`⏰ It's been ${hoursSinceLastRenewal.toFixed(1)} hours since last renewal. Starting renewal...`);
      this.renewAllTokens();
    }
  }
  
  // Replace token at index
  replaceToken(index, newToken) {
    if (newToken) {
      this.tokens[index] = newToken;
      console.log(`🔄 Token at index ${index} replaced`);
      // Update last renewal time when a token is successfully replaced
      this.lastRenewalTime = Date.now();
    }
  }
  
  // Schedule token renewals at regular intervals
  scheduleTokenRenewals() {
    // Renew tokens every 4 hours
    setInterval(() => {
      this.renewAllTokens();
    }, 4 * 60 * 60 * 1000);
  }
  
  // Handle token error/expiry
  async handleTokenError(tokenIndex) {
    // Track renewal attempts to avoid infinite loops
    if (!this.renewalAttempts[tokenIndex]) {
      this.renewalAttempts[tokenIndex] = 0;
    }
    
    this.renewalAttempts[tokenIndex]++;
    
    // Only try to renew 3 times max per token
    if (this.renewalAttempts[tokenIndex] <= 3) {
      console.log(`🔑 Token ${tokenIndex} seems expired. Attempting renewal (attempt ${this.renewalAttempts[tokenIndex]})...`);
      const newToken = await renewToken(this.credentials[tokenIndex]);
      if (newToken) {
        this.replaceToken(tokenIndex, newToken);
        this.renewalAttempts[tokenIndex] = 0; // Reset counter after successful renewal
        return true;
      }
    } else {
      console.log(`⚠️ Max renewal attempts reached for token ${tokenIndex}`);
      
      // Reset counter after some time (30 minutes)
      setTimeout(() => {
        console.log(`🔄 Resetting renewal counter for token ${tokenIndex}`);
        this.renewalAttempts[tokenIndex] = 0;
      }, 30 * 60 * 1000);
    }
    return false;
  }

  // Get a valid token
  getValidToken() {
    const token = this.getToken();
    if (!token) {
      console.log('⚠️ No valid token available, attempting renewal...');
      this.renewAllTokens();
      return this.getToken();
    }
    return token;
  }
}

// Initialize token manager
const tokenManager = new TokenManager(AUTH_TOKENS, USER_CREDENTIALS);

// Updated fetch data function with token renewal
const fetchData = async (url, retries = 3) => {
  const tokenIndex = tokenManager.currentIndex;
  const currentToken = tokenManager.getToken();
  
  try {
    // Add a small random delay between requests
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    
    console.log(`🔄 Fetching data from: ${url}`);
    const response = await axios(url, {
      method: 'GET',
      headers: getRequestHeaders(currentToken),
      timeout: 10000,
      validateStatus: status => status < 500 // Don't reject if status < 500
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers['retry-after'] || 5;
      console.log(`⏳ Rate limited. Waiting ${retryAfter} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return fetchData(url, retries);
    }
    
    // Handle unauthorized
    if (response.status === 401 || response.status === 403) {
      console.log('⚠️ Token expired or invalid. Attempting renewal...');
      const renewed = await tokenManager.handleTokenError(tokenIndex);
      
      if (renewed && retries > 0) {
        return fetchData(url, retries - 1);
      }
      throw new Error('Token renewal failed');
    }
    
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      if (retries > 0) {
        const delay = Math.floor(Math.random() * 2000) + 1000;
        console.log(`⏳ Request timeout. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchData(url, retries - 1);
      }
    }
    
    throw error;
  }
};

// Transform Market Data for Display
const transformMarketData = (market) => {
  // Base market data that's common to all types
  const baseMarket = {
    id: market.id,
    name: market.name,
    groupById: market.groupById,
    status: market.status,
    statusLabel: market.statusLabel,
    inPlay: market.inPlay,
    btype: market.btype,
    mtype: market.mtype,
    start: market.start,
    competition: market.competition,
    event: market.event,
    isStreamAvailable: market.isStreamAvailable,
    isFancy: market.isFancy,
    maxBet: market.maxBet,
    maxMarket: market.maxMarket,
    minBet: market.minBet,
    betDelay: market.betDelay
  };

  // Match Odds markets
  if (market.mtype === 'MATCH_ODDS' || market.mtype === 'MATCH_ODDS_SB') {
    return {
      ...baseMarket,
      displayType: 'MATCH_ODDS',
      runners: market.runners?.map(runner => ({
        id: runner.id,
        name: runner.name,
        status: runner.status,
        back: Array.isArray(runner.back) ? runner.back : [runner.back].filter(Boolean),
        lay: Array.isArray(runner.lay) ? runner.lay : [runner.lay].filter(Boolean),
        sequence: runner.sequence,
        runnerState: runner.runnerState
      })) || []
    };
  }

  // Fancy markets (including session odds, over runs, etc.)
  if (market.btype === 'LINE' || 
      market.mtype === 'INNINGS_RUNS' || 
      market.name.includes('Over') || 
      market.name.includes('Session') || 
      market.name.includes('Lambi') ||
      market.isFancy) {
    return {
      ...baseMarket,
      displayType: 'FANCY',
      runners: market.runners?.map(runner => ({
        id: runner.id,
        name: runner.name,
        status: runner.status,
        // For fancy markets, back is typically "YES" and lay is "NO"
        yes: {
          price: runner.back?.[0]?.price || runner.back?.price || 0,
          size: runner.back?.[0]?.size || runner.back?.size || 0
        },
        no: {
          price: runner.lay?.[0]?.price || runner.lay?.price || 0,
          size: runner.lay?.[0]?.size || runner.lay?.size || 0
        },
        sequence: runner.sequence,
        runnerState: runner.runnerState,
        minStake: runner.minStake,
        maxStake: runner.maxStake
      })) || [],
      minStake: market.minStake,
      maxStake: market.maxStake,
      betLock: market.betLock,
      suspended: market.status === 'SUSPENDED'
    };
  }

  // Bookmaker markets
  if (market.isBookmaker || market.name.includes('BOOKMAKER')) {
    return {
      ...baseMarket,
      displayType: 'BOOKMAKER',
      runners: market.runners?.map(runner => ({
        id: runner.id,
        name: runner.name,
        status: runner.status,
        back: Array.isArray(runner.back) ? runner.back : [runner.back].filter(Boolean),
        lay: Array.isArray(runner.lay) ? runner.lay : [runner.lay].filter(Boolean),
        sequence: runner.sequence,
        runnerState: runner.runnerState
      })) || []
    };
  }

  // Toss markets
  if (market.name.toLowerCase().includes('toss')) {
    return {
      ...baseMarket,
      displayType: 'TOSS',
      runners: market.runners?.map(runner => ({
        id: runner.id,
        name: runner.name,
        status: runner.status,
        back: Array.isArray(runner.back) ? runner.back : [runner.back].filter(Boolean),
        lay: Array.isArray(runner.lay) ? runner.lay : [runner.lay].filter(Boolean),
        sequence: runner.sequence
      })) || []
    };
  }

  // Other markets (fall through case)
  return {
    ...baseMarket,
    displayType: 'OTHER',
    runners: market.runners?.map(runner => ({
      id: runner.id,
      name: runner.name,
      status: runner.status,
      back: Array.isArray(runner.back) ? runner.back : [runner.back].filter(Boolean),
      lay: Array.isArray(runner.lay) ? runner.lay : [runner.lay].filter(Boolean),
      sequence: runner.sequence,
      runnerState: runner.runnerState
    })) || []
  };
};

// WebSocket message handler to broadcast market updates
const broadcastMarketUpdate = (wss, market) => {
  const transformedMarket = transformMarketData(market);
  
  // Broadcast to all connected clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'marketUpdate',
        data: transformedMarket
      }));
    }
  });
};

// Function to process market data before sending
const processMarketData = (markets) => {
  if (!Array.isArray(markets)) {
    console.error('❌ Invalid market data format:', markets);
    return [];
  }

  return markets
    .filter(market => market && market.name) // Filter out invalid markets
    .map(transformMarketData)
    .filter(market => market.displayType); // Filter out markets that couldn't be transformed
};

// Market Data Store for centralized data management
class MarketDataStore {
  constructor() {
    this.matchListData = null;
    this.matchDetailsData = new Map();
    this.subscribers = new Map();
    this.lastFetchTimes = new Map();
  }

  // Store match list data
  setMatchList(data) {
    this.matchListData = data;
    this.broadcastMatchList();
  }

  // Store match details data
  setMatchDetails(matchId, data) {
    this.matchDetailsData.set(matchId, data);
    this.broadcastMatchDetails(matchId);
  }

  // Get match list data
  getMatchList() {
    return this.matchListData;
  }

  // Get match details data
  getMatchDetails(matchId) {
    return this.matchDetailsData.get(matchId);
  }

  // Subscribe client to updates
  subscribe(clientId, ws) {
    this.subscribers.set(clientId, {
      ws,
      matchIds: new Set(),
      wantsList: false
    });
  }

  // Unsubscribe client
  unsubscribe(clientId) {
    this.subscribers.delete(clientId);
  }

  // Subscribe client to match list updates
  subscribeToMatchList(clientId) {
    const subscriber = this.subscribers.get(clientId);
    if (subscriber) {
      subscriber.wantsList = true;
      // Send initial data if available
      if (this.matchListData) {
        this.sendToClient(clientId, {
          type: 'matchList',
          data: this.matchListData
        });
      }
    }
  }

  // Subscribe client to match details updates
  subscribeToMatch(clientId, matchId) {
    const subscriber = this.subscribers.get(clientId);
    if (subscriber) {
      subscriber.matchIds.add(matchId);
      // Send initial data if available
      const matchData = this.matchDetailsData.get(matchId);
      if (matchData) {
        this.sendToClient(clientId, {
          type: 'matchDetails',
          matchId,
          data: matchData
        });
      }
    }
  }

  // Unsubscribe client from match updates
  unsubscribeFromMatch(clientId, matchId) {
    const subscriber = this.subscribers.get(clientId);
    if (subscriber) {
      subscriber.matchIds.delete(matchId);
    }
  }

  // Broadcast match list to all subscribed clients
  broadcastMatchList() {
    const message = JSON.stringify({
      type: 'matchList',
      data: this.matchListData
    });

    for (const [clientId, subscriber] of this.subscribers) {
      if (subscriber.wantsList && subscriber.ws.readyState === WebSocket.OPEN) {
        subscriber.ws.send(message);
      }
    }
  }

  // Broadcast match details to subscribed clients
  broadcastMatchDetails(matchId) {
    const data = this.matchDetailsData.get(matchId);
    if (!data) return;

    const message = JSON.stringify({
      type: 'matchDetails',
      matchId,
      data
    });

    for (const [clientId, subscriber] of this.subscribers) {
      if (subscriber.matchIds.has(matchId) && subscriber.ws.readyState === WebSocket.OPEN) {
        subscriber.ws.send(message);
      }
    }
  }

  // Send data to specific client
  sendToClient(clientId, data) {
    const subscriber = this.subscribers.get(clientId);
    if (subscriber && subscriber.ws.readyState === WebSocket.OPEN) {
      subscriber.ws.send(JSON.stringify(data));
    }
  }

  // Check if we need to fetch new data
  shouldFetch(key) {
    const lastFetch = this.lastFetchTimes.get(key);
    if (!lastFetch) return true;

    const now = Date.now();
    // For match list: fetch if last fetch was more than 30 seconds ago
    if (key === 'matchList') {
      return (now - lastFetch) > 30000;
    }
    // For match details: fetch if last fetch was more than 500ms ago
    return (now - lastFetch) > 500;
  }

  // Update last fetch time
  updateFetchTime(key) {
    this.lastFetchTimes.set(key, Date.now());
  }

  // Get all active match IDs
  getActiveMatchIds() {
    const activeMatches = new Set();
    for (const subscriber of this.subscribers.values()) {
      for (const matchId of subscriber.matchIds) {
        activeMatches.add(matchId);
      }
    }
    return Array.from(activeMatches);
  }
}

// Initialize market data store
const marketStore = new MarketDataStore();

// Update the data fetcher to use the market store
class DataFetcher {
  constructor(tokenManager, marketStore) {
    this.tokenManager = tokenManager;
    this.marketStore = marketStore;
  }

  async fetchMatchList() {
    // Only fetch if enough time has passed since last fetch
    if (!this.marketStore.shouldFetch('matchList')) {
      return this.marketStore.getMatchList();
    }

    try {
      const token = this.tokenManager.getValidToken();
      if (!token) {
        console.error('❌ No valid token available for match list');
        return null;
      }

      const response = await axios.get('https://gobook9.com/api/exchange/odds/eventType/4', {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://gobook9.com',
          'Referer': 'https://gobook9.com/sports/4'
        }
      });

      if (!response.data || !response.data.result) {
        console.error('❌ Invalid data received from API:', response.data);
        return null;
      }

      const filteredData = response.data.result
        .filter(match => match.tabGroupName !== 'Premium Cricket');

      this.marketStore.setMatchList(filteredData);
      this.marketStore.updateFetchTime('matchList');
      return filteredData;
    } catch (error) {
      console.error('❌ Error fetching match list:', error.message);
      return null;
    }
  }

  async fetchMatchDetails(matchId) {
    // Only fetch if enough time has passed since last fetch
    if (!this.marketStore.shouldFetch(matchId)) {
      return this.marketStore.getMatchDetails(matchId);
    }

    try {
      const token = this.tokenManager.getValidToken();
      if (!token) {
        console.error(`❌ No valid token available for match ${matchId}`);
        return null;
      }

      // First try d-sma-event API format
      try {
        const response = await axios.get(`https://gobook9.com/api/exchange/odds/d-sma-event/4/${matchId}`, {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://gobook9.com',
            'Referer': 'https://gobook9.com/sports/4'
          }
        });

        if (response.data && response.data.result) {
          const filteredMarkets = response.data.result
            .filter(market => market.tabGroupName !== 'Premium Cricket')
            .map(market => transformMarketData(market));

          this.marketStore.setMatchDetails(matchId, filteredMarkets);
          this.marketStore.updateFetchTime(matchId);
          return filteredMarkets;
        }
      } catch (firstError) {
        console.log(`⚠️ d-sma-event API failed: ${firstError.message}. Trying alternative...`);
      }

      // Try direct event API as fallback
      const response = await axios.get(`https://gobook9.com/api/exchange/odds/event/${matchId}`, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://gobook9.com',
          'Referer': 'https://gobook9.com/sports/4'
        }
      });

      if (response.data && response.data.result) {
        const filteredMarkets = response.data.result
          .filter(market => market.tabGroupName !== 'Premium Cricket')
          .map(market => transformMarketData(market));

        this.marketStore.setMatchDetails(matchId, filteredMarkets);
        this.marketStore.updateFetchTime(matchId);
        return filteredMarkets;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error fetching match details for ${matchId}:`, error.message);
      return null;
    }
  }
}

// Initialize data fetcher with market store
const dataFetcher = new DataFetcher(tokenManager, marketStore);

// Update WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = Date.now();
  marketStore.subscribe(clientId, ws);

  console.log(`🔌 Client ${clientId} connected`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        if (data.matchId) {
          marketStore.subscribeToMatch(clientId, data.matchId);
        } else {
          marketStore.subscribeToMatchList(clientId);
        }
      } else if (data.type === 'unsubscribe') {
        if (data.matchId) {
          marketStore.unsubscribeFromMatch(clientId, data.matchId);
        } else {
          marketStore.unsubscribe(clientId);
        }
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  ws.on('close', () => {
    marketStore.unsubscribe(clientId);
    console.log(`🔌 Client ${clientId} disconnected`);
  });
});

// Update data fetching intervals
async function updateMatchData() {
  // Fetch match list every 30 seconds
  setInterval(async () => {
    await dataFetcher.fetchMatchList();
  }, 30000);

  // Fetch match details every 500ms
  setInterval(async () => {
    const activeMatches = marketStore.getActiveMatchIds();
    for (const matchId of activeMatches) {
      await dataFetcher.fetchMatchDetails(matchId);
    }
  }, 500);
}

// Start the server
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  updateMatchData();
});
