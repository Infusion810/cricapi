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

// Token renewal function
const renewToken = async (credentials) => {
  try {
    console.log(`🔑 Attempting to renew token for ${credentials.username} via direct API call...`);
    
    // Make a direct API call to the login endpoint
    try {
      const response = await axios.post('https://gobook9.com/api/auth/b2b/login', {
        username: credentials.username,
        password: credentials.password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://gobook9.com',
          'Referer': 'https://gobook9.com/login'
        }
      });
      
      // Check if the authorization header is present in the response
      const authToken = response.headers['authorization'];
      
      if (authToken) {
        console.log(`✅ Successfully obtained token from response headers for ${credentials.username}: ${authToken.substring(0, 30)}...`);
        return authToken;
      } else {
        console.error(`❌ No authorization header found in response for ${credentials.username}`);
        
        // Try to get token from response body as fallback
        if (response.data && response.data.result && response.data.result.token) {
          console.log(`✅ Successfully obtained token from response body for ${credentials.username}: ${response.data.result.token.substring(0, 30)}...`);
          return response.data.result.token;
        }
        
        return null;
      }
    } catch (error) {
      console.error(`❌ API call error for ${credentials.username}:`, error.message);
      
      // Log additional error details if available
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      return null;
    }
  } catch (error) {
    console.error(`❌ Error in renewToken for ${credentials.username}:`, error.message);
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
    
    // Start token renewal process immediately
    this.initialRenewal();
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
  
  // Initial token renewal to get fresh tokens
  async initialRenewal() {
    console.log('🚀 Performing initial token renewal...');
    await this.renewAllTokens();
    
    // Then schedule regular renewals
    this.scheduleTokenRenewals();
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
  
  // Renew all tokens
  async renewAllTokens() {
    console.log('🔄 Starting token renewal process...');
    
    let renewedAny = false;
    
    for (let i = 0; i < this.credentials.length; i++) {
      // Try to renew with puppeteer
      let newToken = await renewToken(this.credentials[i]);
      
      // If successful, update token
      if (newToken) {
        this.replaceToken(i, newToken);
        this.renewalAttempts[i] = 0; // Reset counter after successful renewal
        renewedAny = true;
      } else {
        console.log(`⚠️ Failed to renew token for ${this.credentials[i].username}, will retry later`);
      }
    }
    
    if (!renewedAny) {
      console.log('⚠️ Could not renew any tokens. Will try again after delay.');
      // Schedule a retry after 5 minutes
      setTimeout(() => {
        console.log('🔄 Retrying token renewal after delay...');
        this.renewAllTokens();
      }, 5 * 60 * 1000);
    } else {
      console.log('✅ Token renewal process completed with some success');
      this.lastRenewalTime = Date.now();
    }
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
  // Get the current token index before getting a token
  const tokenIndex = tokenManager.currentIndex;
  
  // Get a token from the manager
  const currentToken = tokenManager.getToken();
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': currentToken,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Origin': 'https://gobook9.com',
      'Referer': 'https://gobook9.com/sports/4'
    },
    timeout: 8000 // Increased timeout for more reliability
  };
  
  try {
    console.log(`🔄 Fetching data from: ${url} with token index: ${tokenIndex}`);
    const response = await axios(url, options);
    
    // If we get here, the request succeeded, but check if the response contains any error indicators
    if (response.data && (response.data.error || response.data.message === 'Unauthorized')) {
      console.log(`⚠️ API returned error: ${response.data.error || response.data.message}`);
      
      // Try to renew the token
      const renewed = await tokenManager.handleTokenError(tokenIndex);
      
      if (renewed && retries > 0) {
        console.log(`🔄 Retrying request with new token. Retries left: ${retries-1}`);
        return fetchData(url, retries - 1);
      }
    }
    
    return response.data;
  } catch (error) {
    // If unauthorized (401) or forbidden (403), try token renewal
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log(`⚠️ Token error (${error.response.status}) detected. Attempting renewal...`);
      
      // Try to renew the token that failed
      const renewed = await tokenManager.handleTokenError(tokenIndex);
      
      if (renewed && retries > 0) {
        console.log(`🔄 Retrying request with new token. Retries left: ${retries-1}`);
        // Wait briefly before retrying to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchData(url, retries - 1);
      }
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      // Handle timeout errors
      console.log(`⚠️ Request timeout: ${error.message}`);
      if (retries > 0) {
        console.log(`🔄 Retrying after timeout. Retries left: ${retries-1}`);
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchData(url, retries - 1);
      }
    }
    
    console.error(`❌ Fetch error: ${error.message}`);
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
