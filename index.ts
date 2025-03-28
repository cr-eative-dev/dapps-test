import { ApiPromise, WsProvider } from '@polkadot/api';
import { polkadot as polkadotUpgrades } from '@polkadot/types-known/upgrades/manual';
import chalk from 'chalk';

const main = async () => {
    console.log(chalk.cyan.bold('🔄 Connecting to Polkadot network...'));
    const api = await ApiPromise.create({
        provider: new WsProvider('wss://rpc.polkadot.io')
    });

    await api.isReady;
    console.log(chalk.green('✅ Connected successfully\n'));

    console.log(chalk.cyan.bold('🔍 Fetching block hashes...'));
    const blockHashes = polkadotUpgrades.map(([number, _]) => {
        return api.rpc.chain.getBlockHash(number);
    });

    const hashesResolved = await Promise.all(blockHashes);
    console.log(chalk.green(`✅ Retrieved ${hashesResolved.length} block hashes\n`));

    const palletData: Record<string, string[]> = {};
    const runtimeVersions: string[] = [];

    console.log(chalk.cyan.bold('📊 Collecting pallets for each runtime...'));
    // collect all the pallets for each runtime
    for (let i = 0; i < hashesResolved.length; i++) {
        const apiAt = await api.at(hashesResolved[i]);
        const pallets = Object.keys(apiAt.query);
        const runtimeInfo = await api.rpc.state.getRuntimeVersion(hashesResolved[i]);
        const specVersion = runtimeInfo.specVersion.toString();

        palletData[specVersion] = pallets;
        runtimeVersions.push(specVersion);

        console.log(chalk.blue(`Runtime ${chalk.bold(specVersion)} at block ${chalk.bold(polkadotUpgrades[i][0])} has ${chalk.bold(pallets.length)} pallets`));
    }

    // sort runtime versions by number
    runtimeVersions.sort((a, b) => parseInt(a) - parseInt(b));
    console.log(chalk.green('\n✅ Pallet collection complete\n'));

    console.log(chalk.cyan.bold('🔄 Analyzing runtime changes...\n'));
    // track which pallets stayed, got added or got removed
    for (let i = 1; i < runtimeVersions.length; i++) {
        const prevVersion = runtimeVersions[i - 1];
        const currVersion = runtimeVersions[i];

        const prevPallets = new Set(palletData[prevVersion]);
        const currPallets = new Set(palletData[currVersion]);

        // find pallets that got removed
        const removed = [...prevPallets].filter(pallet => !currPallets.has(pallet));

        // find pallets that got added
        const added = [...currPallets].filter(pallet => !prevPallets.has(pallet));

        // find pallets that stayed
        const stayed = [...prevPallets].filter(pallet => currPallets.has(pallet));

        console.log(chalk.magenta.bold(`Changes from runtime ${prevVersion} to ${currVersion}:`));

        if (removed.length > 0) {
            console.log(chalk.red(`❌ Removed pallets (${removed.length}): ${removed.join(', ')}`));
        } else {
            console.log(chalk.green('✅ No pallets were removed'));
        }

        if (added.length > 0) {
            console.log(chalk.green(`✨ Added pallets (${added.length}): ${added.join(', ')}`));
        } else {
            console.log(chalk.yellow('🔄 No pallets were added'));
        }

        console.log(chalk.blue(`🔒 Retained pallets (${stayed.length}): ${stayed.length > 20 ?
            `${stayed.slice(0, 20).join(', ')}... (and ${stayed.length - 20} more)` :
            stayed.join(', ')}`));

        console.log(); // visual spacer
    }

    // pallets that are present in all RT versions
    const allPallets = new Set<string>();
    Object.values(palletData).forEach(pallets => {
        pallets.forEach(pallet => allPallets.add(pallet));
    });

    const palletsInAllVersions = [...allPallets].filter(pallet =>
        runtimeVersions.every(version => palletData[version].includes(pallet))
    );

    console.log(chalk.cyan.bold(`🌟 Pallets present in all ${runtimeVersions.length} runtime versions (${palletsInAllVersions.length}):`));

    // final list formatting
    const formattedPallets = palletsInAllVersions
        .sort()
        .map(pallet => chalk.green(pallet))
        .join(', ');

    console.log(formattedPallets);
};

// chalk header
console.log('\n' + chalk.yellow.bold('=================================='));
console.log(chalk.yellow.bold('📊 Awesome Magic Polkadot Runtime Analysis Tool 📊'));
console.log(chalk.yellow.bold('==================================\n'));

main()
    .catch(err => console.error(chalk.red.bold('❌ Error:'), chalk.red(err)))
    .finally(() => {
        console.log(chalk.yellow.bold('\n=================================='));
        console.log(chalk.green.bold('✅ Analysis complete. DOT to the MOON!!!'));
        console.log(chalk.yellow.bold('==================================\n'));
        process.exit();
    });
