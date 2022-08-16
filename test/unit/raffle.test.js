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
                const raffleState = await  raffle.getRaffleState()
                
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
                // using the above line to make the contract beliver the interval has passed and to perform upkeep
                await network.provider.send("evm_mine", []) //using to tell hardhat network to go to next block or mnine the next block
                //we pretend to be a chainlink keeper
                await raffle.performUpkeep([])
                await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle__NotOpen")
            })
        })
        describe("checkUpkeep", async function(){
            it("return false if people havent sent any eth", async function(){
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                //as checkUpkeep is a public function await ``await checkUpkeep([]) --> this will kick of an transaction, if it was a public view it would have not
                //we dont want to send an actual transaction but to simulate sending a transaction to what would the upkeepNeeded would return
                //this can be done using something call callStatic
                const {upkeepNeeded} =  await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)   //because right now upkeepNeeded should return false
            })
            it("returns false if raffle isnt open", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee}))
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                // await raffle.performUpkeep("0x")  //another way to send blank byte object harthat is smart enough to transform it into black bytes object
                await raffle.performUpkeep([])  //this will also work as above
                const raffleState = await raffle.getRaffleState()
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })
            it("return false if enough time hasnt passed", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee}))
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                // await network.provider.send("evm_mine",[])
                await network.provider.request({ method: "evm_mine",params: []})
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert.equal(upkeepNeeded, false)
            })
            it("returns true enough time has passed,has players, eth and is open", async function(){
                await expect(raffle.enterRaffle({value: raffleEntranceFee}))
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine",[])
                const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
                assert.equal(upkeepNeeded, true)
            })
        })
    })

