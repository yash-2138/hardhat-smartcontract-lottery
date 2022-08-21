const { assert,expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")


!developmentChains.includes(network.name)
    ?describe.skip
    :describe("Raffle Unit Tests",  function(){
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
        describe("Constructor",  function (){
            it("Initializes the raffle correctly", async function(){
                //Ideally we make our test have only 1 assert per it
                const raffleState = await  raffle.getRaffleState()
                
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })
        })
        describe("enterRaffle",  function(){
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
        describe("checkUpkeep",  function(){
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
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 3])
                await network.provider.send("evm_mine",[])
                // await network.provider.request({ method: "evm_mine",params: []})
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
        describe("performUpkeep", function(){
            it("it can only run if checkUpkeep is true", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep([])
                assert(tx)
            })
            it("it reverts when checkUpkeep is false", async function(){
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
            })
            it("it updates the raffle state,emits an event, calls the vrf coordinator", async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() +1])
                await network.provider.send("evm_mine", [])
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.events[1].args.requestId  // 1 beacause the 0th event will be of requestRandomWord
                const raffleState = await raffle.getRaffleState()
                assert(requestId.toNumber()>0)
                assert(raffleState.toString() == "1")
            })
        })
        describe("fulfillRandomWords", function() {
            //befor we do any testing on fulfillRandomWords, we want someone to have entered the lottery, increased the time and a block to be mined
             beforeEach(async function(){
                await raffle.enterRaffle({value: raffleEntranceFee})
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine",[])
             })
             //fulfillRandomWords can only be called until there is requestId
             it("it can only be called after performUpkeep", async function(){
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0,raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1,raffle.address)).to.be.revertedWith("nonexistent request")
             })

             it("picks a winner,resets the lottery, send money",async function(){
                const additionalEntrants = 3;
                const startingAccountIndex = 1; //0 is for deployer
                const accounts = await ethers.getSigners()
                for(let i = startingAccountIndex; i< startingAccountIndex + additionalEntrants;i++){
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp()

                //we want to performUpkeep (mock being chainlink keepers)
                //which will kick of calling fulfillRandomWords (mock being the chainlink vrf)
                //we will have to wait for the fulfillRandomWords to be called

                //listen for this winnerPicked event
                await new Promise( async (resolve, reject) =>{
                    raffle.once("WinnerPicked", async ()=> {
                        //once the winner picked event get fired
                        console.log("Found the event!")
                        try{
                            const recentWinner = await raffle.getRecentWinner()

                            console.log(recentWinner)
                            console.log(accounts[2].address)
                            console.log(accounts[3].address)
                            console.log(accounts[4].address)
                            console.log(accounts[5].address)

                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLatestTimeStamp()
                            const numPlayers = await raffle.getNumberOfPlayers()
                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(raffleState.toString(), "0")
                            assert(endingTimeStamp > startingTimeStamp)
                        }catch(e){
                            reject(e);
                        }
                        resolve()
                    })
                    //setting up the listner
                    //below, we will fire the event,and the listner will pick it up,and resolve
                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)

                })
             })
        })
    })

