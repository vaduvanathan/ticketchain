// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TicketChain {
    struct Event {
        uint256 id;
        string name;
        string location;
        uint256 eventTime;
        address organizer;
        bool exists;
    }
    
    struct Attendance {
        address participant;
        uint256 checkInTime;
        bool checkedIn;
        int8 punctualityScore;
    }
    
    struct CreditScore {
        int256 totalScore;
        uint256 lastUpdated;
    }
    
    // Mappings
    mapping(uint256 => Event) public events;
    mapping(uint256 => mapping(address => Attendance)) public eventAttendance;
    mapping(address => CreditScore) public userCredits;
    mapping(uint256 => address[]) public eventParticipants;
    mapping(address => uint256[]) public userEvents;
    
    // State variables
    uint256 public eventCounter;
    address public owner;
    
    // Events
    event EventRegistered(uint256 indexed eventId, string name, address indexed organizer);
    event ParticipantCheckedIn(uint256 indexed eventId, address indexed participant, uint256 checkInTime, int8 punctualityScore);
    event CreditScoreUpdated(address indexed user, int256 newScore, string reason);
    event FeedbackSubmitted(uint256 indexed eventId, address indexed reviewer, address indexed reviewee, uint8 rating);
    
    constructor() {
        owner = msg.sender;
        eventCounter = 0;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier eventExists(uint256 _eventId) {
        require(events[_eventId].exists, "Event does not exist");
        _;
    }
    
    /**
     * @dev Register a new event on the blockchain
     * @param _name Event name
     * @param _location Event location
     * @param _eventTime Event timestamp
     */
    function registerEvent(
        string memory _name,
        string memory _location,
        uint256 _eventTime
    ) external returns (uint256) {
        eventCounter++;
        
        events[eventCounter] = Event({
            id: eventCounter,
            name: _name,
            location: _location,
            eventTime: _eventTime,
            organizer: msg.sender,
            exists: true
        });
        
        emit EventRegistered(eventCounter, _name, msg.sender);
        return eventCounter;
    }
    
    /**
     * @dev Check in a participant to an event
     * @param _eventId Event ID
     * @param _participant Participant address (can be different from msg.sender for organizer check-ins)
     */
    function checkIn(uint256 _eventId, address _participant) 
        external 
        eventExists(_eventId) 
    {
        require(
            msg.sender == _participant || msg.sender == events[_eventId].organizer,
            "Only participant or event organizer can check in"
        );
        require(
            !eventAttendance[_eventId][_participant].checkedIn,
            "Already checked in"
        );
        
        uint256 checkInTime = block.timestamp;
        Event memory eventInfo = events[_eventId];
        
        // Calculate punctuality score
        int8 punctualityScore = 0;
        if (checkInTime <= eventInfo.eventTime) {
            punctualityScore = 10; // On time or early
        } else if (checkInTime <= eventInfo.eventTime + 15 minutes) {
            punctualityScore = 5; // Up to 15 minutes late
        } else {
            punctualityScore = -5; // More than 15 minutes late
        }
        
        // Record attendance
        eventAttendance[_eventId][_participant] = Attendance({
            participant: _participant,
            checkInTime: checkInTime,
            checkedIn: true,
            punctualityScore: punctualityScore
        });
        
        // Add to participant lists if not already there
        bool alreadyInList = false;
        for (uint i = 0; i < eventParticipants[_eventId].length; i++) {
            if (eventParticipants[_eventId][i] == _participant) {
                alreadyInList = true;
                break;
            }
        }
        if (!alreadyInList) {
            eventParticipants[_eventId].push(_participant);
            userEvents[_participant].push(_eventId);
        }
        
        // Update credit score
        _updateCreditScore(_participant, punctualityScore, "Event check-in punctuality");
        
        emit ParticipantCheckedIn(_eventId, _participant, checkInTime, punctualityScore);
    }
    
    /**
     * @dev Update a user's credit score
     * @param _user User address
     * @param _scoreChange Score change (can be positive or negative)
     * @param _reason Reason for the score change
     */
    function updateCreditScore(
        address _user,
        int256 _scoreChange,
        string memory _reason
    ) external onlyOwner {
        _updateCreditScore(_user, _scoreChange, _reason);
    }
    
    /**
     * @dev Internal function to update credit score
     */
    function _updateCreditScore(
        address _user,
        int256 _scoreChange,
        string memory _reason
    ) internal {
        userCredits[_user].totalScore += _scoreChange;
        userCredits[_user].lastUpdated = block.timestamp;
        
        emit CreditScoreUpdated(_user, userCredits[_user].totalScore, _reason);
    }
    
    /**
     * @dev Submit feedback for an event participant (organizer/speaker)
     * @param _eventId Event ID
     * @param _reviewee Address of the person being reviewed
     * @param _rating Rating from 1-5
     */
    function submitFeedback(
        uint256 _eventId,
        address _reviewee,
        uint8 _rating
    ) external eventExists(_eventId) {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        require(
            eventAttendance[_eventId][msg.sender].checkedIn,
            "Only event attendees can submit feedback"
        );
        
        // Award points for giving feedback
        _updateCreditScore(msg.sender, 2, "Submitted event feedback");
        
        // Award bonus points for high ratings
        if (_rating >= 4) {
            _updateCreditScore(_reviewee, 5, "Received high rating");
        }
        
        emit FeedbackSubmitted(_eventId, msg.sender, _reviewee, _rating);
    }
    
    /**
     * @dev Get user's credit score
     * @param _user User address
     * @return totalScore Current total score
     * @return lastUpdated Last update timestamp
     */
    function getCreditScore(address _user) 
        external 
        view 
        returns (int256 totalScore, uint256 lastUpdated) 
    {
        CreditScore memory score = userCredits[_user];
        return (score.totalScore, score.lastUpdated);
    }
    
    /**
     * @dev Get event details
     * @param _eventId Event ID
     * @return Event details
     */
    function getEvent(uint256 _eventId) 
        external 
        view 
        eventExists(_eventId)
        returns (Event memory) 
    {
        return events[_eventId];
    }
    
    /**
     * @dev Get attendance details for a participant at an event
     * @param _eventId Event ID
     * @param _participant Participant address
     * @return Attendance details
     */
    function getAttendance(uint256 _eventId, address _participant)
        external
        view
        eventExists(_eventId)
        returns (Attendance memory)
    {
        return eventAttendance[_eventId][_participant];
    }
    
    /**
     * @dev Get all participants for an event
     * @param _eventId Event ID
     * @return Array of participant addresses
     */
    function getEventParticipants(uint256 _eventId)
        external
        view
        eventExists(_eventId)
        returns (address[] memory)
    {
        return eventParticipants[_eventId];
    }
    
    /**
     * @dev Get all events a user has participated in
     * @param _user User address
     * @return Array of event IDs
     */
    function getUserEvents(address _user)
        external
        view
        returns (uint256[] memory)
    {
        return userEvents[_user];
    }
    
    /**
     * @dev Get current event counter
     * @return Current number of events
     */
    function getCurrentEventId() external view returns (uint256) {
        return eventCounter;
    }
}
