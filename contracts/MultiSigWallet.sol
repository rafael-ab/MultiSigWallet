// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/// @title A Multi Signature Wallet
/// @author Rafael Romero
contract MultiSigWallet is Initializable, ContextUpgradeable {
    uint256 public constant MAX_OWNER_COUNT = 50;

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    mapping(address => bool) public isOwner;
    address[] public owners;
    uint256 public required;
    uint256 public nonce;

    struct Transaction {
        address destination;
        uint256 value;
        bytes data;
        bool executed;
    }

    event Confirmation(address indexed sender, uint256 indexed transactionId);
    event Revocation(address indexed sender, uint256 indexed transactionId);
    event Submission(uint256 indexed transactionId);
    event Execution(uint256 indexed transactionId);
    event Deposit(address indexed sender, uint256 value);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    modifier onlyWallet() {
        require(
            _msgSender() == address(this),
            "MultiSigWallet: INVALID_SENDER"
        );
        _;
    }

    modifier ownerDoesNotExist(address owner) {
        require(!isOwner[owner], "MultiSigWallet: OWNER_EXISTS");
        _;
    }

    modifier ownerExists(address owner) {
        require(isOwner[owner], "MultiSigWallet: OWNER_NOT_EXISTS");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(
            transactions[transactionId].destination != address(0),
            "MultiSigWallet: TX_EXISTS"
        );
        _;
    }

    modifier confirmed(uint256 transactionId, address owner) {
        require(
            confirmations[transactionId][owner],
            "MultiSigWallet: TX_CONFIRMED"
        );
        _;
    }

    modifier notConfirmed(uint256 transactionId, address owner) {
        require(
            !confirmations[transactionId][owner],
            "MultiSigWallet: TX_NOT_CONFIRMED"
        );
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(
            !transactions[transactionId].executed,
            "MultiSigWallet: TX_NOT_EXECUTED"
        );
        _;
    }

    modifier notNull(address _address) {
        require(_address != address(0), "MultiSigWallet: ZERO_ADDRESS");
        _;
    }

    modifier validRequirement(uint256 ownerCount, uint256 _required) {
        require(
            ownerCount <= MAX_OWNER_COUNT &&
                _required <= ownerCount &&
                _required != 0 &&
                ownerCount != 0,
            "MultiSigWallet: INVALID_REQUIREMENT"
        );
        _;
    }

    function initialize(address[] memory _owners, uint256 _required)
        external
        initializer
        validRequirement(_owners.length, _required)
    {
        for (uint256 i = 0; i < _owners.length; i++) {
            require(!isOwner[_owners[i]] && _owners[i] != address(0));
            isOwner[_owners[i]] = true;
        }
        owners = _owners;
        required = _required;
    }

    function addOwner(address owner)
        public
        onlyWallet
        ownerDoesNotExist(owner)
        notNull(owner)
        validRequirement(owners.length + 1, required)
    {
        isOwner[owner] = true;
        owners.push(owner);
        emit OwnerAddition(owner);
    }

    function removeOwner(address owner) public onlyWallet ownerExists(owner) {
        isOwner[owner] = false;
        for (uint256 i = 0; i < owners.length - 1; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                break;
            }
        }
        owners.pop();
        if (required > owners.length) {
            changeRequirement(owners.length);
        }
        emit OwnerRemoval(owner);
    }

    function replaceOwner(address owner, address newOwner)
        public
        onlyWallet
        ownerExists(owner)
        ownerDoesNotExist(newOwner)
    {
        for (uint256 i = 0; i < owners.length; i++)
            if (owners[i] == owner) {
                owners[i] = newOwner;
                break;
            }
        isOwner[owner] = false;
        isOwner[newOwner] = true;
        emit OwnerRemoval(owner);
        emit OwnerAddition(newOwner);
    }

    function changeRequirement(uint256 _required)
        public
        onlyWallet
        validRequirement(owners.length, _required)
    {
        required = _required;
        emit RequirementChange(_required);
    }

    function submitTransaction(
        address destination,
        uint256 value,
        bytes memory data
    ) public returns (uint256 transactionId) {
        transactionId = _addTransaction(destination, value, data);
    }

    function confirmTransaction(uint256 transactionId)
        public
        ownerExists(_msgSender())
        transactionExists(transactionId)
        notConfirmed(transactionId, _msgSender())
    {
        confirmations[transactionId][_msgSender()] = true;
        emit Confirmation(_msgSender(), transactionId);
    }

    function revokeConfirmation(uint256 transactionId)
        public
        ownerExists(_msgSender())
        confirmed(transactionId, _msgSender())
        notExecuted(transactionId)
    {
        confirmations[transactionId][_msgSender()] = false;
        emit Revocation(_msgSender(), transactionId);
    }

    function executeTransaction(uint256 transactionId)
        public
        ownerExists(_msgSender())
        confirmed(transactionId, _msgSender())
        notExecuted(transactionId)
    {
        require(isConfirmed(transactionId), "MultiSigWallet: TX_NOT_CONFIRMED");
        Transaction storage txn = transactions[transactionId];
        txn.executed = true;

        (bool success, ) = txn.destination.call{value: txn.value}(txn.data);
        require(success, "MultiSigWallet: TX_FAILED");

        emit Execution(transactionId);
    }

    function isConfirmed(uint256 transactionId) public view returns (bool) {
        uint256 count = 0;
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirmations[transactionId][owners[i]]) count += 1;
            if (count == required) return true;
        }
        return false;
    }

    function _addTransaction(
        address _destination,
        uint256 _value,
        bytes memory _data
    ) internal notNull(_destination) returns (uint256 transactionId) {
        transactionId = nonce;
        transactions[transactionId] = Transaction({
            destination: _destination,
            value: _value,
            data: _data,
            executed: false
        });
        nonce += 1;
        emit Submission(transactionId);
    }

    function getConfirmationCount(uint256 transactionId)
        public
        view
        returns (uint256 count)
    {
        for (uint256 i = 0; i < owners.length; i++)
            if (confirmations[transactionId][owners[i]]) count += 1;
    }

    function getTransactionCount(bool pending, bool executed)
        public
        view
        returns (uint256 count)
    {
        for (uint256 i = 0; i < nonce; i++)
            if (
                (pending && !transactions[i].executed) ||
                (executed && transactions[i].executed)
            ) count += 1;
    }

    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getConfirmations(uint256 transactionId)
        public
        view
        returns (address[] memory _confirmations)
    {
        address[] memory confirmationsTemp = new address[](owners.length);
        uint256 count = 0;
        uint256 i;
        for (i = 0; i < owners.length; i++)
            if (confirmations[transactionId][owners[i]]) {
                confirmationsTemp[count] = owners[i];
                count += 1;
            }
        _confirmations = new address[](count);
        for (i = 0; i < count; i++) _confirmations[i] = confirmationsTemp[i];
    }

    function getTransactionIds(
        uint256 from,
        uint256 to,
        bool pending,
        bool executed
    ) public view returns (uint256[] memory _transactionIds) {
        uint256[] memory transactionIdsTemp = new uint256[](nonce);
        uint256 count = 0;
        uint256 i;
        for (i = 0; i < nonce; i++)
            if (
                (pending && !transactions[i].executed) ||
                (executed && transactions[i].executed)
            ) {
                transactionIdsTemp[count] = i;
                count += 1;
            }
        _transactionIds = new uint256[](to - from);
        for (i = from; i < to; i++)
            _transactionIds[i - from] = transactionIdsTemp[i];
    }

    function deposit() public payable {
        if (msg.value > 0) {
            emit Deposit(_msgSender(), msg.value);
        }
    }

    receive() external payable {
        if (msg.value > 0) {
            emit Deposit(_msgSender(), msg.value);
        }
    }
}
