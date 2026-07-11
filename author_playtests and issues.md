# Test date 11/07/2026
Active Build: feat: playtest batch - effects vs buffs, taunt-stance link, Extort lifecycle, deck QoL (rulings #30-33)
A side note - Add the option to save battle log to a file under /battle-log/, especially on the battle end screen, with details of all mechanics and cards used in the match. This way you would be able to read what happened during the match and debug accordingly.

## Match 1 - 3v3
- Enemy Team : Meliodas, Ban, Diane, Yalina
- Player Team : Gon, Killua, Leorio, Seras

### Issues
- Yalina's momentum works from sub position. Her passive isn't meant to be active from sub position. She should only gain momentum when she is on field, and allies (including herself) use attacks that results in her gaining momentum
- Ban used snatch 3 times in a row on turn 1. I wouldn't say that's not possible but very rare to get two additional snatch cards on turn 1. Also looking at the details, it seems that ban's snatch is stackable? it shouldn't be the case. the new procs only overwrites the previous ones. Even if the old snatch is more potent than the new one.
- Enemy ai may need a bit of tweaking. We will work on it in a future batch.

### The good stuff
- Player team shows correct amount of synergy effects for each character. 5 for gon, killua and leorio because 3 from collab synergy and 2 from leorio passive. it says [buff 5%, buff 5%, buff 5%, buff 10%, buff 10%]
- Damage calculations seem to be correct or atleast in the right ballpark.
- 3 cards used per turn by enemy as expected. Although the available actions should be reduced when there are less than 3 battle members on a team. It should be 1 action per character upto a max of 3. It's fine for practice purposes for now.
- I saw like two instances of 2000+ damage when meliodas used triple attack on leorio twice. It made sense because meli was low on health and his damage was very high along with crit chance. leorio did have a debuff due to ban snatch too so it makes sense.


## Match 2 - 3v3
- Enemy Team - Seras, Sara, Yalina
- Player team - Batra, Lyra, Duke, Leorio (sub)

### Issues
- Leorio's synergy didn't take effect. It is considered seperate from passivve. Passives may or may not activate from sub position but synergy must always be active.
- Enemy synergy effects didn't seem to apply. Seras has a [powerful opponent] synergy and Sara has [Female] one. Seras has one synergy active (i am assuming her own) but she should have two [her own and also Sara's]. Sara doesn't have any active but she should have her own [Female synergy] at the very least
- Sara got [amplify (15% damageDealt)] effect for whatever reason during battle.

### Enjoyed but...
- As duke and lyra don't have synergy, only Batra's synergy was active which is correct. Leorio's synergy should have taken effect even from sub. I addressed that in 'Issues' section.
- After defeating yalina, seras was around 30% hp and Sara was nearly full. My team's Batra was around 70% hp and i queued 2x Level 1 cards followed by ultimate. I only saw win screen after that. I am guessing batra was about to do so much damage that it would have wiped out the remaining enemy team. Although the damage animation was not visible to me and only the win screen was shown
