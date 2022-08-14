const { ethers } = require("hardhat")

const networkConfig = {
    4: {
        name: "rinkeby",
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId : "0",
        callBackGasLimit: "500000",
        interval: "30",
    },

    31337:{
        name: "hardhat",
        //do not need vrfCoordinatorV2 as we are deploying a mock
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        entranceFee: ethers.utils.parseEther("0.01"),
        //in hardhat as we are using mock it doesnt mater on which gasLane we are wqorking on so can give anything 
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId : "0",
        callBackGasLimit: "500000",
        interval: "30",

    }
}

const developmentChains = ["hardhat",  "localhost"]

module.exports ={
    networkConfig,
    developmentChains,
}