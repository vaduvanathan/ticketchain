const { ethers } = require('ethers');
require('dotenv').config();

class BlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.initialized = false;
        
        // Contract ABI (Application Binary Interface)
        this.contractABI = [
            "function registerEvent(string memory _name, string memory _location, uint256 _eventTime) external returns (uint256)",
            "function checkIn(uint256 _eventId, address _participant) external",
            "function updateCreditScore(address _user, int256 _scoreChange, string memory _reason) external",
            "function submitFeedback(uint256 _eventId, address _reviewee, uint8 _rating) external",
            "function getCreditScore(address _user) external view returns (int256 totalScore, uint256 lastUpdated)",
            "function getEvent(uint256 _eventId) external view returns (tuple(uint256 id, string name, string location, uint256 eventTime, address organizer, bool exists))",
            "function getAttendance(uint256 _eventId, address _participant) external view returns (tuple(address participant, uint256 checkInTime, bool checkedIn, int8 punctualityScore))",
            "function getEventParticipants(uint256 _eventId) external view returns (address[])",
            "function getUserEvents(address _user) external view returns (uint256[])",
            "function getCurrentEventId() external view returns (uint256)",
            "event EventRegistered(uint256 indexed eventId, string name, address indexed organizer)",
            "event ParticipantCheckedIn(uint256 indexed eventId, address indexed participant, uint256 checkInTime, int8 punctualityScore)",
            "event CreditScoreUpdated(address indexed user, int256 newScore, string reason)",
            "event FeedbackSubmitted(uint256 indexed eventId, address indexed reviewer, address indexed reviewee, uint8 rating)"
        ];
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Set up provider (using Sepolia testnet as default)
            const networkName = process.env.ETHEREUM_NETWORK || 'sepolia';
            
            if (process.env.ETHEREUM_RPC_URL) {
                this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
            } else {
                // Use Infura or Alchemy if available, otherwise use default
                const infuraKey = process.env.INFURA_PROJECT_ID;
                const alchemyKey = process.env.ALCHEMY_API_KEY;
                
                if (infuraKey) {
                    this.provider = new ethers.InfuraProvider(networkName, infuraKey);
                } else if (alchemyKey) {
                    this.provider = new ethers.AlchemyProvider(networkName, alchemyKey);
                } else {
                    // Use default provider (limited requests)
                    this.provider = ethers.getDefaultProvider(networkName);
                }
            }

            // Set up signer if private key is provided
            if (process.env.PRIVATE_KEY) {
                this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
                console.log('Blockchain service initialized with signer:', this.signer.address);
            } else {
                console.log('Blockchain service initialized in read-only mode (no private key provided)');
            }

            // Set up contract if address is provided
            if (process.env.CONTRACT_ADDRESS) {
                const contractAddress = process.env.CONTRACT_ADDRESS;
                this.contract = new ethers.Contract(
                    contractAddress, 
                    this.contractABI, 
                    this.signer || this.provider
                );
                console.log('Smart contract connected at:', contractAddress);
            } else {
                console.log('No contract address provided. Contract interactions will be unavailable.');
            }

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize blockchain service:', error);
            throw error;
        }
    }

    async registerEvent(name, location, eventTime) {
        await this.initialize();
        
        if (!this.contract || !this.signer) {
            throw new Error('Contract or signer not available');
        }

        try {
            const eventTimestamp = Math.floor(new Date(eventTime).getTime() / 1000);
            const tx = await this.contract.registerEvent(name, location, eventTimestamp);
            const receipt = await tx.wait();
            
            // Find the EventRegistered event in the logs
            const eventLog = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'EventRegistered';
                } catch {
                    return false;
                }
            });

            if (eventLog) {
                const parsed = this.contract.interface.parseLog(eventLog);
                return {
                    eventId: parsed.args.eventId.toString(),
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber
                };
            }

            throw new Error('EventRegistered event not found in transaction logs');
        } catch (error) {
            console.error('Error registering event on blockchain:', error);
            throw error;
        }
    }

    async checkInParticipant(eventId, participantAddress) {
        await this.initialize();
        
        if (!this.contract || !this.signer) {
            throw new Error('Contract or signer not available');
        }

        try {
            const tx = await this.contract.checkIn(eventId, participantAddress);
            const receipt = await tx.wait();
            
            // Find the ParticipantCheckedIn event in the logs
            const eventLog = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'ParticipantCheckedIn';
                } catch {
                    return false;
                }
            });

            if (eventLog) {
                const parsed = this.contract.interface.parseLog(eventLog);
                return {
                    eventId: parsed.args.eventId.toString(),
                    participant: parsed.args.participant,
                    checkInTime: parsed.args.checkInTime.toString(),
                    punctualityScore: parsed.args.punctualityScore,
                    transactionHash: receipt.hash,
                    blockNumber: receipt.blockNumber
                };
            }

            throw new Error('ParticipantCheckedIn event not found in transaction logs');
        } catch (error) {
            console.error('Error checking in participant on blockchain:', error);
            throw error;
        }
    }

    async updateCreditScore(userAddress, scoreChange, reason) {
        await this.initialize();
        
        if (!this.contract || !this.signer) {
            throw new Error('Contract or signer not available');
        }

        try {
            const tx = await this.contract.updateCreditScore(userAddress, scoreChange, reason);
            const receipt = await tx.wait();
            
            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error updating credit score on blockchain:', error);
            throw error;
        }
    }

    async submitFeedback(eventId, revieweeAddress, rating) {
        await this.initialize();
        
        if (!this.contract || !this.signer) {
            throw new Error('Contract or signer not available');
        }

        try {
            const tx = await this.contract.submitFeedback(eventId, revieweeAddress, rating);
            const receipt = await tx.wait();
            
            return {
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            console.error('Error submitting feedback on blockchain:', error);
            throw error;
        }
    }

    async getCreditScore(userAddress) {
        await this.initialize();
        
        if (!this.contract) {
            throw new Error('Contract not available');
        }

        try {
            const [totalScore, lastUpdated] = await this.contract.getCreditScore(userAddress);
            return {
                totalScore: totalScore.toString(),
                lastUpdated: lastUpdated.toString()
            };
        } catch (error) {
            console.error('Error getting credit score from blockchain:', error);
            throw error;
        }
    }

    async getEvent(eventId) {
        await this.initialize();
        
        if (!this.contract) {
            throw new Error('Contract not available');
        }

        try {
            const event = await this.contract.getEvent(eventId);
            return {
                id: event.id.toString(),
                name: event.name,
                location: event.location,
                eventTime: event.eventTime.toString(),
                organizer: event.organizer,
                exists: event.exists
            };
        } catch (error) {
            console.error('Error getting event from blockchain:', error);
            throw error;
        }
    }

    async getAttendance(eventId, participantAddress) {
        await this.initialize();
        
        if (!this.contract) {
            throw new Error('Contract not available');
        }

        try {
            const attendance = await this.contract.getAttendance(eventId, participantAddress);
            return {
                participant: attendance.participant,
                checkInTime: attendance.checkInTime.toString(),
                checkedIn: attendance.checkedIn,
                punctualityScore: attendance.punctualityScore
            };
        } catch (error) {
            console.error('Error getting attendance from blockchain:', error);
            throw error;
        }
    }

    async getEventParticipants(eventId) {
        await this.initialize();
        
        if (!this.contract) {
            throw new Error('Contract not available');
        }

        try {
            const participants = await this.contract.getEventParticipants(eventId);
            return participants;
        } catch (error) {
            console.error('Error getting event participants from blockchain:', error);
            throw error;
        }
    }

    async getUserEvents(userAddress) {
        await this.initialize();
        
        if (!this.contract) {
            throw new Error('Contract not available');
        }

        try {
            const eventIds = await this.contract.getUserEvents(userAddress);
            return eventIds.map(id => id.toString());
        } catch (error) {
            console.error('Error getting user events from blockchain:', error);
            throw error;
        }
    }

    // Utility function to convert timestamp to human readable date
    timestampToDate(timestamp) {
        return new Date(parseInt(timestamp) * 1000).toISOString();
    }

    // Utility function to convert date to timestamp
    dateToTimestamp(dateString) {
        return Math.floor(new Date(dateString).getTime() / 1000);
    }
}

module.exports = BlockchainService;
