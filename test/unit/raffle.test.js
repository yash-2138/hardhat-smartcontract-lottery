const { assert,expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")


!developmentChains.includes(network.name)
    ?describe.skip
    :describe("Raffle Unit Tests", async function(){
        let raffle, vrfCoordinatorV2Mock,raffleEntranceFee, deployer, interval
        const chainId = network.config.chainId

        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })
        describe("Constructor", async function (){
            it("Initializes the raffle correctly", async function(){
                //Ideally we make our test have only 1 assert per it
                const raffleState = await  raffle.getRafflestate()
                
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })
        describe("enterRaffle", async function(){
            it("reverts when you don't pay enough", async function(){
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughEthEntered")
            })
            it("record players when they enter", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits event on enter", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(raffle,"RaffleEnter")
            })
            it("doesn't allow entrance when raffle is calculating", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee}))
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                //we pretend to be a chainlink keeper
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen")
            })
        })
    })

