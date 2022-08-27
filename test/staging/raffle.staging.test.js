const { assert,expect } = require("chai");
const { network, getNamedAccounts, ethers } = require("hardhat");
const {developmentChains, networkConfig} = require("../../helper-hardhat-config")


developmentChains.includes(network.name)
    ?describe.skip
    :describe("Raffle Unit Tests",  function(){
        let raffle, raffleEntranceFee, deployer 

        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
        })
        describe("fulfillRandomWords", function(){
            it("works with live chainlink keepers and chainlink vrf, we get a random winner", async function(){
                //enter raffle
                console.log("Setting up test...")
                const startingTimeStamp = await raffle.getLatestTimeStamp()
                const accounts = await ethers.getSigners()
                await new Promise(async (resolve, reject) =>{
                    //setup listner before we enter the raffle
                    //just in case the blockchain moves really fast
                    raffle.once("WinnerPicked", async function(){
                        console.log("WinnerPicked event fired!")
                       
                        try{
                            //add our asserts here
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const WinnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await  raffle.getLatestTimeStamp()

                            await expect(raffle.getPlayer(0)).to.be.reverted  //there will not be any object at 0 
                            //another way to see that our players array is reset
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            assert.equal(raffleState.toString(), "0") 
                            assert.equal(WinnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())
                            assert(endingTimeStamp > startingTimeStamp)
                            resolve()
                        }catch(error){
                            console.log(error)
                            reject(error)
                        }
                    })
                    //then entering the raffle
                    
                    console.log("Entering Raffle...")
                    const tx = await raffle.enterRaffle({value: raffleEntranceFee})
                    await tx.wait(2)
                    const winnerStartingBalance = await accounts[0].getBalance()

                    
                    //and this code wont run until the listner has finished listning
                })
                
            }) 
        })
    })

