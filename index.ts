import { ApiPromise, WsProvider } from '@polkadot/api';
import { polkadot as polkadotUpgrades } from '@polkadot/types-known/upgrades/manual';

const main = async () => {
    const api = await ApiPromise.create({
        provider: new WsProvider('wss://rpc.polkadot.io')
    });

    await api.isReady;

    const blockHashes = polkadotUpgrades.map(([number, _]) => {
        return api.rpc.chain.getBlockHash(number);
    });

    const hashesResolved = await Promise.all(blockHashes);

    const palletData: Record<string, string[]> = {};
    const runtimeVersions: string[] = [];

    // collect all the pallets for each runtime
    for (let i = 0; i < hashesResolved.length; i++) {
        const apiAt = await api.at(hashesResolved[i]);
        const pallets = Object.keys(apiAt.query);
        const runtimeInfo = await api.rpc.state.getRuntimeVersion(hashesResolved[i]);
        const specVersion = runtimeInfo.specVersion.toString();

        palletData[specVersion] = pallets;
        runtimeVersions.push(specVersion);

        console.log(`Runtime ${specVersion} at block ${polkadotUpgrades[i][0]} has ${pallets.length} pallets`);
    }

    // sort runtime versions numerically
    runtimeVersions.sort((a, b) => parseInt(a) - parseInt(b));

    // track which pallets stayed, got added, or removed
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

        console.log(`\nChanges from runtime ${prevVersion} to ${currVersion}:`);

        if (removed.length > 0) {
            console.log(`Removed pallets (${removed.length}): ${removed.join(', ')}`);
        } else {
            console.log('No pallets were removed');
        }

        if (added.length > 0) {
            console.log(`Added pallets (${added.length}): ${added.join(', ')}`);
        } else {
            console.log('No pallets were added');
        }

        console.log(`Retained pallets (${stayed.length}): ${stayed.join(', ')}`);
    }

    // pallets that are present in all RT versions
    const allPallets = new Set<string>();
    Object.values(palletData).forEach(pallets => {
        pallets.forEach(pallet => allPallets.add(pallet));
    });

    const palletsInAllVersions = [...allPallets].filter(pallet =>
        runtimeVersions.every(version => palletData[version].includes(pallet))
    );

    console.log(`\nPallets present in all ${runtimeVersions.length} runtime versions (${palletsInAllVersions.length}):`);
    console.log(palletsInAllVersions.join(', '));
};

main().catch(err => console.error(err)).finally(() => process.exit());
